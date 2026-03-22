import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { AnimatePresence, motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Plus, Edit, Trash2, UploadCloud } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { deleteStoragePaths, isSupabaseReady, uploadImageFile } from '@/lib/supabaseStorage';

const showSyncWarning = (toast) => {
  toast({
    title: 'Aviso',
    description: 'Alterações salvas localmente, mas não foi possível sincronizar com o Supabase.',
  });
};

const CrudItem = ({ item, onEdit, onDelete, children }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, x: -20 }}
    className="p-4 bg-gray-50 rounded-lg flex justify-between items-center"
  >
    <div>{children}</div>
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
        <Edit className="h-4 w-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(item.id || item.name)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </motion.div>
);

// #region SettingsHomePage
const SettingsHomePage = () => {
  const { siteData, updateSiteData } = useData();
  const { toast } = useToast();
  const [heroFiles, setHeroFiles] = useState([]);
  const [patronessFile, setPatronessFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewsDialogOpen, setIsNewsDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [newsImageFile, setNewsImageFile] = useState(null);
  const [isSavingNews, setIsSavingNews] = useState(false);
  const [newsSettings, setNewsSettings] = useState(() => ({
    autoplay: siteData.home.newsSettings?.autoplay ?? true,
    intervalSeconds: siteData.home.newsSettings?.intervalSeconds ?? 6,
  }));
  const [isSavingNewsSettings, setIsSavingNewsSettings] = useState(false);

  useEffect(() => {
    setNewsSettings({
      autoplay: siteData.home.newsSettings?.autoplay ?? true,
      intervalSeconds: siteData.home.newsSettings?.intervalSeconds ?? 6,
    });
  }, [siteData.home.newsSettings]);

  const onHeroDrop = useCallback((acceptedFiles) => {
    const imageFiles = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setHeroFiles((prev) => [...prev, ...imageFiles]);
  }, []);

  const onPatronessDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles[0]) {
        if (patronessFile?.preview) {
          URL.revokeObjectURL(patronessFile.preview);
        }
        const file = acceptedFiles[0];
        setPatronessFile(
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          })
        );
      }
    },
    [patronessFile]
  );

  const onNewsDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles[0]) {
        if (newsImageFile?.preview) {
          URL.revokeObjectURL(newsImageFile.preview);
        }
        const file = acceptedFiles[0];
        setNewsImageFile(
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          })
        );
      }
    },
    [newsImageFile]
  );

  const {
    getRootProps: getHeroRootProps,
    getInputProps: getHeroInputProps,
    isDragActive: isHeroDragActive,
  } = useDropzone({
    onDrop: onHeroDrop,
    accept: { 'image/*': [] },
  });

  const {
    getRootProps: getPatronessRootProps,
    getInputProps: getPatronessInputProps,
    isDragActive: isPatronessDragActive,
  } = useDropzone({
    onDrop: onPatronessDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const {
    getRootProps: getNewsRootProps,
    getInputProps: getNewsInputProps,
    isDragActive: isNewsDragActive,
  } = useDropzone({
    onDrop: onNewsDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const welcomeMessage = e.target.welcomeMessage.value;
    const patronessText = e.target.patronessText.value;

    const hasHeroUpload = heroFiles.length > 0;
    const hasPatronessUpload = Boolean(patronessFile);

    if ((hasHeroUpload || hasPatronessUpload) && !isSupabaseReady) {
      toast({
        title: 'Erro',
        description: 'Supabase não configurado para upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      let uploadedHeroImages = [];
      let failedHeroFiles = [];

      if (hasHeroUpload) {
        const results = await Promise.allSettled(
          heroFiles.map((file) =>
            uploadImageFile({
              file,
              folder: 'home/hero',
              generateThumbnail: true,
              thumbnailMaxWidth: 1400,
              thumbnailMaxHeight: 900,
              thumbnailQuality: 0.8,
            })
          )
        );

        const uploaded = [];

        results.forEach((result, index) => {
          const file = heroFiles[index];
          if (result.status === 'fulfilled') {
            uploaded.push({ ...result.value, file });
            if (file?.preview) {
              URL.revokeObjectURL(file.preview);
            }
          } else {
            failedHeroFiles.push(file);
          }
        });

        uploadedHeroImages = uploaded.map((item, index) => ({
          id: Date.now() + index,
          src: item.publicUrl,
          thumbSrc: item.thumbUrl || item.publicUrl,
          alt: item.file?.name || 'Imagem do banner',
          path: item.path,
          thumbPath: item.thumbPath || null,
        }));
      }

      let updatedPatronessImage = siteData.home.patronessImage;
      let updatedPatronessPath = siteData.home.patronessImagePath || null;
      let updatedPatronessThumb = siteData.home.patronessThumb || siteData.home.patronessImage;
      let updatedPatronessThumbPath = siteData.home.patronessThumbPath || null;

      if (hasPatronessUpload) {
        const result = await uploadImageFile({
          file: patronessFile,
          folder: 'home/patroness',
          generateThumbnail: true,
          thumbnailMaxWidth: 900,
          thumbnailMaxHeight: 1200,
        });
        updatedPatronessImage = result.publicUrl;
        updatedPatronessPath = result.path;
        updatedPatronessThumb = result.thumbUrl || result.publicUrl;
        updatedPatronessThumbPath = result.thumbPath || null;

        if (siteData.home.patronessImagePath && siteData.home.patronessImagePath !== result.path) {
          try {
            await deleteStoragePaths([siteData.home.patronessImagePath]);
          } catch (error) {
            toast({ title: 'Aviso', description: 'Não foi possível remover a imagem antiga.' });
          }
        }

        if (siteData.home.patronessThumbPath && siteData.home.patronessThumbPath !== updatedPatronessThumbPath) {
          try {
            await deleteStoragePaths([siteData.home.patronessThumbPath]);
          } catch (error) {
            toast({ title: 'Aviso', description: 'Não foi possível remover a miniatura antiga.' });
          }
        }
      }

      const updatedHeroImages = [...siteData.home.heroImages, ...uploadedHeroImages];

      const result = await updateSiteData({
        ...siteData,
        home: {
          ...siteData.home,
          welcomeMessage,
          patronessText,
          heroImages: updatedHeroImages,
          patronessImage: updatedPatronessImage,
          patronessImagePath: updatedPatronessPath,
          patronessThumb: updatedPatronessThumb,
          patronessThumbPath: updatedPatronessThumbPath,
        },
      });

      if (failedHeroFiles.length > 0) {
        toast({ title: 'Aviso', description: `${failedHeroFiles.length} imagens falharam no upload.` });
        setHeroFiles(failedHeroFiles);
      } else {
        setHeroFiles([]);
      }

      if (patronessFile?.preview) {
        URL.revokeObjectURL(patronessFile.preview);
      }
      setPatronessFile(null);

      if (!result.ok) {
        showSyncWarning(toast);
      } else {
        toast({ title: 'Sucesso!', description: 'Página inicial atualizada.' });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: error?.message || 'Falha ao salvar as alterações.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteImage = async (id) => {
    const imageToDelete = siteData.home.heroImages.find((img) => img.id === id);
    if ((imageToDelete?.path || imageToDelete?.thumbPath) && isSupabaseReady) {
      try {
        await deleteStoragePaths([imageToDelete.path, imageToDelete.thumbPath].filter(Boolean));
      } catch (error) {
        toast({ title: 'Aviso', description: 'Não foi possível remover a imagem do storage.' });
      }
    }
    if (imageToDelete && imageToDelete.src.startsWith('blob:')) {
      URL.revokeObjectURL(imageToDelete.src);
    }
    const updatedImages = siteData.home.heroImages.filter((img) => img.id !== id);
    const result = await updateSiteData({ ...siteData, home: { ...siteData.home, heroImages: updatedImages } });
    if (!result.ok) {
      showSyncWarning(toast);
    } else {
      toast({ title: 'Sucesso!', description: 'Imagem do banner removida.' });
    }
  };

  const newsItems = Array.isArray(siteData.home.news) ? siteData.home.news : [];

  const openNewsDialog = (item = null) => {
    setEditingNews(item);
    setNewsImageFile(null);
    setIsNewsDialogOpen(true);
  };

  const closeNewsDialog = () => {
    if (newsImageFile?.preview) {
      URL.revokeObjectURL(newsImageFile.preview);
    }
    setNewsImageFile(null);
    setEditingNews(null);
    setIsNewsDialogOpen(false);
  };

  const handleSaveNews = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      id: editingNews?.id || Date.now(),
      title: (formData.get('newsTitle') || '').trim(),
      summary: (formData.get('newsSummary') || '').trim(),
      content: (formData.get('newsContent') || '').trim(),
      date: formData.get('newsDate') || new Date().toISOString().slice(0, 10),
      category: (formData.get('newsCategory') || '').trim(),
      ctaLabel: (formData.get('newsCtaLabel') || '').trim(),
      ctaUrl: (formData.get('newsCtaUrl') || '').trim(),
      pinned: formData.get('newsPinned') === 'on',
      startAt: formData.get('newsStartAt') || '',
      endAt: formData.get('newsEndAt') || '',
      image: editingNews?.image || '',
      imagePath: editingNews?.imagePath || null,
      thumb: editingNews?.thumb || '',
      thumbPath: editingNews?.thumbPath || null,
    };

    if (newsImageFile && !isSupabaseReady) {
      toast({
        title: 'Erro',
        description: 'Supabase não configurado para upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingNews(true);
    try {
      if (newsImageFile) {
        const result = await uploadImageFile({
          file: newsImageFile,
          folder: 'home/news',
          generateThumbnail: true,
          thumbnailMaxWidth: 1100,
          thumbnailMaxHeight: 800,
        });
        payload.image = result.publicUrl;
        payload.imagePath = result.path;
        payload.thumb = result.thumbUrl || result.publicUrl;
        payload.thumbPath = result.thumbPath || null;

        if (editingNews?.imagePath && editingNews.imagePath !== result.path) {
          try {
            await deleteStoragePaths([editingNews.imagePath]);
          } catch (error) {
            toast({ title: 'Aviso', description: 'Não foi possível remover a imagem antiga.' });
          }
        }

        if (editingNews?.thumbPath && editingNews.thumbPath !== payload.thumbPath) {
          try {
            await deleteStoragePaths([editingNews.thumbPath]);
          } catch (error) {
            toast({ title: 'Aviso', description: 'Não foi possível remover a miniatura antiga.' });
          }
        }
      }

      const updatedNews = editingNews
        ? newsItems.map((item) => (item.id === editingNews.id ? { ...item, ...payload } : item))
        : [{ ...payload }, ...newsItems];

      const result = await updateSiteData({
        ...siteData,
        home: {
          ...siteData.home,
          news: updatedNews,
        },
      });

      if (!result.ok) {
        showSyncWarning(toast);
      } else {
        toast({ title: 'Sucesso!', description: `Notícia ${editingNews ? 'atualizada' : 'criada'}.` });
      }

      closeNewsDialog();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error?.message || 'Falha ao salvar a notícia.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNews(false);
    }
  };

  const handleDeleteNews = async (id) => {
    const itemToDelete = newsItems.find((item) => item.id === id);
    if ((itemToDelete?.imagePath || itemToDelete?.thumbPath) && isSupabaseReady) {
      try {
        await deleteStoragePaths([itemToDelete.imagePath, itemToDelete.thumbPath].filter(Boolean));
      } catch (error) {
        toast({ title: 'Aviso', description: 'Não foi possível remover a imagem do storage.' });
      }
    }

    const updatedNews = newsItems.filter((item) => item.id !== id);
    const result = await updateSiteData({
      ...siteData,
      home: {
        ...siteData.home,
        news: updatedNews,
      },
    });

    if (!result.ok) {
      showSyncWarning(toast);
    } else {
      toast({ title: 'Sucesso!', description: 'Notícia removida.' });
    }
  };

  const handleSaveNewsSettings = async () => {
    setIsSavingNewsSettings(true);
    const sanitizedInterval = Math.max(2, Math.min(30, Number(newsSettings.intervalSeconds || 6)));
    const payload = {
      autoplay: Boolean(newsSettings.autoplay),
      intervalSeconds: sanitizedInterval,
    };
    try {
      const result = await updateSiteData({
        ...siteData,
        home: {
          ...siteData.home,
          newsSettings: payload,
        },
      });
      if (!result.ok) {
        showSyncWarning(toast);
      } else {
        toast({ title: 'Sucesso!', description: 'Configurações de notícias atualizadas.' });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: error?.message || 'Falha ao salvar configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNewsSettings(false);
    }
  };

  return (
    <div className="space-y-10">
      <form onSubmit={handleFormSubmit} className="space-y-8">
      <div className="space-y-2">
        <Label htmlFor="welcomeMessage" className="text-lg font-semibold">
          Mensagem de Boas-Vindas
        </Label>
        <Textarea
          id="welcomeMessage"
          name="welcomeMessage"
          defaultValue={siteData.home.welcomeMessage}
          rows={4}
          className="bg-white"
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Banner Rotativo</h3>
        <div
          {...getHeroRootProps()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors flex flex-col items-center justify-center"
        >
          <input {...getHeroInputProps()} />
          <UploadCloud className="h-12 w-12 text-gray-400 mb-4" />
          {isHeroDragActive ? (
            <p>Solte as imagens aqui...</p>
          ) : (
            <p>Arraste e solte imagens aqui, ou clique para selecionar</p>
          )}
          <p className="text-xs text-gray-500 mt-2">Recomenda-se usar imagens de alta qualidade.</p>
        </div>
        {heroFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Novas imagens para o banner:</h4>
            {heroFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
                <img src={file.preview} alt="preview" className="w-16 h-16 object-contain rounded bg-gray-200" />
                <span className="text-sm truncate">{file.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Imagens atuais no banner:</h4>
          <AnimatePresence>
            {siteData.home.heroImages.map((image) => (
              <motion.div
                key={image.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -50 }}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={image.thumbSrc || image.src}
                    alt={image.alt}
                    className="w-20 h-20 object-contain rounded-md bg-gray-200"
                  />
                  <span className="text-sm text-gray-600 truncate">{image.alt}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteImage(image.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Seção da Padroeira</h3>
        <div className="space-y-2">
          <Label htmlFor="patronessText">Texto da Padroeira</Label>
          <Textarea
            id="patronessText"
            name="patronessText"
            defaultValue={siteData.home.patronessText}
            rows={4}
            className="bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label>Imagem da Padroeira</Label>
          <div
            {...getPatronessRootProps()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors flex flex-col items-center justify-center"
          >
            <input {...getPatronessInputProps()} />
            <UploadCloud className="h-12 w-12 text-gray-400 mb-4" />
            {isPatronessDragActive ? (
              <p>Solte a imagem aqui...</p>
            ) : (
              <p>Arraste e solte uma imagem aqui, ou clique para selecionar</p>
            )}
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div>
              <p className="text-sm font-semibold">Imagem Atual:</p>
              <img
                src={siteData.home.patronessThumb || siteData.home.patronessImage}
                alt="Padroeira Atual"
                className="w-32 h-32 object-contain rounded bg-gray-200 mt-2"
              />
            </div>
            {patronessFile && (
              <div>
                <p className="text-sm font-semibold">Nova Imagem:</p>
                <img
                  src={patronessFile.preview}
                  alt="Nova Padroeira"
                  className="w-32 h-32 object-contain rounded bg-gray-200 mt-2"
                />
              </div>
            )}
          </div>
        </div>
      </div>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar alterações da página inicial'}
        </Button>
      </form>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Notícias e Divulgações</h3>
          <Button type="button" onClick={() => openNewsDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Notícia
          </Button>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 space-y-3">
          <h4 className="font-semibold text-gray-800">Configurações do carrossel</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newsSettings.autoplay}
                onChange={(event) =>
                  setNewsSettings((prev) => ({ ...prev, autoplay: event.target.checked }))
                }
              />
              Autoplay do carrossel
            </label>
            <div className="space-y-1">
              <Label htmlFor="newsInterval">Intervalo (segundos)</Label>
              <Input
                id="newsInterval"
                type="number"
                min="2"
                max="30"
                value={newsSettings.intervalSeconds}
                onChange={(event) =>
                  setNewsSettings((prev) => ({ ...prev, intervalSeconds: event.target.value }))
                }
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={handleSaveNewsSettings}
            disabled={isSavingNewsSettings}
          >
            {isSavingNewsSettings ? 'Salvando...' : 'Salvar configurações'}
          </Button>
        </div>

        {newsItems.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma notícia cadastrada.</p>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {newsItems.map((item) => (
                <CrudItem key={item.id} item={item} onEdit={openNewsDialog} onDelete={handleDeleteNews}>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-24 rounded-md bg-blue-50 overflow-hidden flex items-center justify-center">
                      {item.thumb || item.image ? (
                        <img
                          src={item.thumb || item.image}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-blue-700">Sem imagem</span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{item.title}</p>
                      <p className="text-xs text-gray-500">
                        {item.category || 'Sem categoria'} {item.date ? `• ${item.date}` : ''}
                      </p>
                      <p className="text-sm text-gray-600">{item.summary}</p>
                    </div>
                  </div>
                </CrudItem>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Dialog
        open={isNewsDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeNewsDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNews ? 'Editar' : 'Adicionar'} Notícia</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveNews} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="newsTitle">Título</Label>
              <Input
                id="newsTitle"
                name="newsTitle"
                defaultValue={editingNews?.title}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newsSummary">Resumo</Label>
              <Textarea
                id="newsSummary"
                name="newsSummary"
                defaultValue={editingNews?.summary}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newsContent">Texto completo</Label>
              <Textarea
                id="newsContent"
                name="newsContent"
                defaultValue={editingNews?.content}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="newsDate">Data</Label>
                <Input
                  id="newsDate"
                  name="newsDate"
                  type="date"
                  defaultValue={editingNews?.date || ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newsCategory">Categoria</Label>
                <Input
                  id="newsCategory"
                  name="newsCategory"
                  defaultValue={editingNews?.category}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="newsCtaLabel">Texto do botão (opcional)</Label>
                <Input
                  id="newsCtaLabel"
                  name="newsCtaLabel"
                  defaultValue={editingNews?.ctaLabel}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newsCtaUrl">Link (opcional)</Label>
                <Input
                  id="newsCtaUrl"
                  name="newsCtaUrl"
                  defaultValue={editingNews?.ctaUrl}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="newsStartAt">Mostrar a partir de</Label>
                <Input
                  id="newsStartAt"
                  name="newsStartAt"
                  type="date"
                  defaultValue={editingNews?.startAt || ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="newsEndAt">Expira em</Label>
                <Input
                  id="newsEndAt"
                  name="newsEndAt"
                  type="date"
                  defaultValue={editingNews?.endAt || ''}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="newsPinned"
                name="newsPinned"
                type="checkbox"
                defaultChecked={editingNews?.pinned}
              />
              <Label htmlFor="newsPinned">Fixar como destaque</Label>
            </div>
            <div className="space-y-2">
              <Label>Imagem</Label>
              <div
                {...getNewsRootProps()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                <input {...getNewsInputProps()} />
                <UploadCloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                {isNewsDragActive ? (
                  <p>Solte a imagem aqui...</p>
                ) : (
                  <p>Arraste uma imagem ou clique para selecionar</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                {editingNews?.thumb || editingNews?.image ? (
                  <div>
                    <p className="text-sm font-semibold">Imagem atual:</p>
                    <img
                      src={editingNews.thumb || editingNews.image}
                      alt="Atual"
                      className="w-24 h-16 object-cover rounded bg-gray-200 mt-1"
                    />
                  </div>
                ) : null}
                {newsImageFile && (
                  <div>
                    <p className="text-sm font-semibold">Nova imagem:</p>
                    <img
                      src={newsImageFile.preview}
                      alt="Nova"
                      className="w-24 h-16 object-cover rounded bg-gray-200 mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isSavingNews}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSavingNews}>
                {isSavingNews ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
// #endregion

// #region SettingsCommunities
const SettingsCommunities = () => {
  const { siteData, updateSiteData } = useData();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [communityFiles, setCommunityFiles] = useState([]);
  const [communityImages, setCommunityImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const normalizeCommunityImages = (images = [], name = 'Comunidade') =>
    (Array.isArray(images) ? images : [])
      .map((image, index) => {
        if (!image) return null;
        if (typeof image === 'string') {
          return {
            src: image,
            alt: `${name} - Foto ${index + 1}`,
          };
        }
        if (!image.src) return null;
        return {
          ...image,
          alt: image.alt || `${name} - Foto ${index + 1}`,
        };
      })
      .filter(Boolean);

  const openDialog = (item = null) => {
    setCurrentItem(item);
    setCommunityImages(normalizeCommunityImages(item?.images, item?.name));
    setCommunityFiles([]);
    setRemovedImages([]);
    setIsDialogOpen(true);
  };

  const onCommunityDrop = useCallback((acceptedFiles) => {
    const imageFiles = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setCommunityFiles((prev) => [...prev, ...imageFiles]);
  }, []);

  const {
    getRootProps: getCommunityRootProps,
    getInputProps: getCommunityInputProps,
    isDragActive: isCommunityDragActive,
  } = useDropzone({
    onDrop: onCommunityDrop,
    accept: { 'image/*': [] },
  });

  const removeCommunityFile = (file) => {
    setCommunityFiles((prev) => prev.filter((item) => item !== file));
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }
  };

  const removeCommunityImage = (image) => {
    setCommunityImages((prev) => prev.filter((item) => item !== image));
    setRemovedImages((prev) => [...prev, image]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      description: formData.get('description'),
      address: formData.get('address'),
      massTimes: formData.get('massTimes'),
      coordinator: formData.get('coordinator'),
    };
    const communityId =
      currentItem?.id || `${data.name.toLowerCase().replace(/ /g, '-')}-${Date.now()}`;

    if (communityFiles.length > 0 && !isSupabaseReady) {
      toast({
        title: 'Erro',
        description: 'Supabase não configurado para upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      let uploadedImages = [];
      let failedFiles = [];

      if (communityFiles.length > 0) {
        const results = await Promise.allSettled(
          communityFiles.map((file) =>
            uploadImageFile({
              file,
              folder: `communities/${communityId}`,
              generateThumbnail: true,
              thumbnailMaxWidth: 900,
              thumbnailMaxHeight: 900,
            })
          )
        );

        results.forEach((result, index) => {
          const file = communityFiles[index];
          if (result.status === 'fulfilled') {
            uploadedImages.push({
              src: result.value.publicUrl,
              path: result.value.path,
              thumbSrc: result.value.thumbUrl || result.value.publicUrl,
              thumbPath: result.value.thumbPath || null,
              alt: file?.name || `${data.name} - Foto ${communityImages.length + uploadedImages.length + 1}`,
            });
            if (file?.preview) {
              URL.revokeObjectURL(file.preview);
            }
          } else {
            failedFiles.push(file);
          }
        });
      }

      const mergedImages = [...communityImages, ...uploadedImages];

      let updatedCommunities;
      if (currentItem) {
        updatedCommunities = siteData.communities.map((c) =>
          c.id === currentItem.id ? { ...c, ...data, images: mergedImages } : c
        );
      } else {
        updatedCommunities = [...siteData.communities, { id: communityId, ...data, images: mergedImages }];
      }

      const result = await updateSiteData({ ...siteData, communities: updatedCommunities });

      if (failedFiles.length > 0) {
        toast({ title: 'Aviso', description: `${failedFiles.length} imagens falharam no upload.` });
        setCommunityFiles(failedFiles);
      } else {
        setCommunityFiles([]);
      }

      if (result.ok && removedImages.length > 0 && isSupabaseReady) {
        const removedPaths = removedImages
          .flatMap((image) => [image.path, image.thumbPath])
          .filter(Boolean);
        if (removedPaths.length > 0) {
          try {
            await deleteStoragePaths([...new Set(removedPaths)]);
          } catch (error) {
            toast({ title: 'Aviso', description: 'Não foi possível remover imagens do storage.' });
          }
        }
      }

      if (!result.ok) {
        showSyncWarning(toast);
      } else {
        toast({
          title: 'Sucesso!',
          description: `Comunidade ${currentItem ? 'atualizada' : 'criada'}.`,
        });
      }

      if (failedFiles.length === 0) {
        setIsDialogOpen(false);
        setCurrentItem(null);
        setCommunityImages([]);
        setRemovedImages([]);
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: error?.message || 'Falha ao salvar a comunidade.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const communityToDelete = siteData.communities.find((c) => c.id === id);
    const updatedCommunities = siteData.communities.filter((c) => c.id !== id);
    const result = await updateSiteData({ ...siteData, communities: updatedCommunities });
    if (result.ok && communityToDelete?.images?.length && isSupabaseReady) {
      const removedPaths = communityToDelete.images
        .flatMap((image) => [image.path, image.thumbPath])
        .filter(Boolean);
      if (removedPaths.length > 0) {
        try {
          await deleteStoragePaths([...new Set(removedPaths)]);
        } catch (error) {
          toast({ title: 'Aviso', description: 'Não foi possível remover imagens do storage.' });
        }
      }
    }
    if (!result.ok) {
      showSyncWarning(toast);
    } else {
      toast({ title: 'Sucesso!', description: 'Comunidade excluída.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gerenciar Comunidades</h3>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Comunidade
        </Button>
      </div>
      <div className="space-y-4">
        <AnimatePresence>
          {siteData.communities.map((item) => (
            <CrudItem key={item.id} item={item} onEdit={openDialog} onDelete={handleDelete}>
              <p className="font-semibold text-gray-800">{item.name}</p>
            </CrudItem>
          ))}
        </AnimatePresence>
      </div>
      <Dialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) {
            communityFiles.forEach((file) => {
              if (file?.preview) {
                URL.revokeObjectURL(file.preview);
              }
            });
            setCommunityFiles([]);
            setCommunityImages([]);
            setRemovedImages([]);
            setCurrentItem(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentItem ? 'Editar' : 'Nova'} Comunidade</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" defaultValue={currentItem?.name} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Descrição/Histórico</Label>
              <Textarea id="description" name="description" defaultValue={currentItem?.description} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="address">Endereço</Label>
              <Input id="address" name="address" defaultValue={currentItem?.address} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="massTimes">Horário de Missas</Label>
              <Input id="massTimes" name="massTimes" defaultValue={currentItem?.massTimes} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="coordinator">Coordenador/Contato</Label>
              <Input id="coordinator" name="coordinator" defaultValue={currentItem?.coordinator} />
            </div>
            <div className="space-y-3">
              <Label>Fotos da Comunidade</Label>
              <div
                {...getCommunityRootProps()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                <input {...getCommunityInputProps()} />
                <UploadCloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                {isCommunityDragActive ? (
                  <p>Solte as imagens aqui...</p>
                ) : (
                  <p>Arraste e solte imagens aqui, ou clique para selecionar</p>
                )}
              </div>

              {communityFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Novas fotos:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {communityFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="relative group">
                        <img src={file.preview} alt={file.name} className="h-24 w-full object-cover rounded-md border" />
                        <button
                          type="button"
                          onClick={() => removeCommunityFile(file)}
                          className="absolute top-1 right-1 bg-white/90 text-red-600 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold">Fotos atuais:</p>
                {communityImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {communityImages.map((image, index) => (
                      <div key={image.path || image.src || index} className="relative group">
                        <img
                          src={image.thumbSrc || image.src}
                          alt={image.alt || `Foto ${index + 1}`}
                          className="h-24 w-full object-cover rounded-md border"
                        />
                        <button
                          type="button"
                          onClick={() => removeCommunityImage(image)}
                          className="absolute top-1 right-1 bg-white/90 text-red-600 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nenhuma foto cadastrada.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
// #endregion

// #region SettingsPastorals
const SettingsPastorals = () => {
  const { siteData, updateSiteData } = useData();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [currentCategory, setCurrentCategory] = useState(null);

  const openDialog = (category, item = null) => {
    setCurrentCategory(category);
    setCurrentItem(item);
    setIsDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    let updatedCategoryItems;
    if (currentItem) {
      updatedCategoryItems = siteData.pastorals[currentCategory].map((p) =>
        p.name === currentItem.name ? { ...currentItem, ...data } : p
      );
    } else {
      updatedCategoryItems = [...siteData.pastorals[currentCategory], data];
    }

    const result = await updateSiteData({
      ...siteData,
      pastorals: { ...siteData.pastorals, [currentCategory]: updatedCategoryItems },
    });

    if (!result.ok) {
      showSyncWarning(toast);
    } else {
      toast({ title: 'Sucesso!', description: `Item ${currentItem ? 'atualizado' : 'criado'}.` });
    }
    setIsDialogOpen(false);
    setCurrentItem(null);
    setCurrentCategory(null);
  };

  const handleDelete = async (category, name) => {
    const updatedCategoryItems = siteData.pastorals[category].filter((p) => p.name !== name);
    const result = await updateSiteData({
      ...siteData,
      pastorals: { ...siteData.pastorals, [category]: updatedCategoryItems },
    });
    if (!result.ok) {
      showSyncWarning(toast);
    } else {
      toast({ title: 'Sucesso!', description: 'Item excluído.' });
    }
  };

  const categories = { pastorais: 'Pastorais', movimentos: 'Movimentos', servicos: 'Serviços' };

  return (
    <div className="space-y-8">
      {Object.entries(categories).map(([key, title]) => (
        <div key={key}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Button onClick={() => openDialog(key)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {(siteData.pastorals[key] || []).map((item) => (
                <CrudItem
                  key={item.name}
                  item={{ ...item, id: item.name }}
                  onEdit={() => openDialog(key, item)}
                  onDelete={() => handleDelete(key, item.name)}
                >
                  <p className="font-semibold text-gray-800">{item.name}</p>
                </CrudItem>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ))}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) {
            setCurrentItem(null);
            setCurrentCategory(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentItem ? 'Editar' : 'Novo'} Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" defaultValue={currentItem?.name} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="objective">Objetivo</Label>
              <Textarea id="objective" name="objective" defaultValue={currentItem?.objective} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="responsible">Responsáveis</Label>
              <Input id="responsible" name="responsible" defaultValue={currentItem?.responsible} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="howToParticipate">Como Participar</Label>
              <Input id="howToParticipate" name="howToParticipate" defaultValue={currentItem?.howToParticipate} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="meeting">Dia e Horário</Label>
              <Input id="meeting" name="meeting" defaultValue={currentItem?.meeting} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
// #endregion

// #region SettingsTeam
const SettingsTeam = () => {
  const { siteData, updateSiteData } = useData();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles[0]) {
        if (imageFile?.preview) {
          URL.revokeObjectURL(imageFile.preview);
        }
        const file = acceptedFiles[0];
        setImageFile(
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          })
        );
      }
    },
    [imageFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const openDialog = (item = null) => {
    setCurrentItem(item);
    setImageFile(null);
    setIsDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      role: formData.get('role'),
      contact: formData.get('contact'),
    };

    if (imageFile && !isSupabaseReady) {
      toast({
        title: 'Erro',
        description: 'Supabase não configurado para upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      let newImageSrc = currentItem?.image;
      let newImagePath = currentItem?.imagePath || null;
      let newImageThumb = currentItem?.imageThumb || currentItem?.image || null;
      let newImageThumbPath = currentItem?.imageThumbPath || null;

      if (imageFile) {
        const result = await uploadImageFile({
          file: imageFile,
          folder: 'team',
          generateThumbnail: true,
          thumbnailMaxWidth: 700,
          thumbnailMaxHeight: 900,
        });
        newImageSrc = result.publicUrl;
        newImagePath = result.path;
        newImageThumb = result.thumbUrl || result.publicUrl;
        newImageThumbPath = result.thumbPath || null;

        if (currentItem?.imagePath && currentItem.imagePath !== result.path) {
          try {
            await deleteStoragePaths([currentItem.imagePath]);
          } catch (error) {
            toast({ title: 'Aviso', description: 'Não foi possível remover a imagem antiga.' });
          }
        }

        if (currentItem?.imageThumbPath && currentItem.imageThumbPath !== newImageThumbPath) {
          try {
            await deleteStoragePaths([currentItem.imageThumbPath]);
          } catch (error) {
            toast({ title: 'Aviso', description: 'Não foi possível remover a miniatura antiga.' });
          }
        }

        if (currentItem?.image && currentItem.image.startsWith('blob:')) {
          URL.revokeObjectURL(currentItem.image);
        }
      }

      let updatedTeam;
      if (currentItem) {
        updatedTeam = siteData.team.map((t) =>
          t.id === currentItem.id
            ? {
                ...t,
                ...data,
                image: newImageSrc,
                imagePath: newImagePath,
                imageThumb: newImageThumb,
                imageThumbPath: newImageThumbPath,
              }
            : t
        );
      } else {
        updatedTeam = [
          ...siteData.team,
          {
            id: Date.now(),
            ...data,
            image: newImageSrc || 'https://via.placeholder.com/300x400',
            imagePath: newImagePath,
            imageThumb: newImageThumb || newImageSrc || 'https://via.placeholder.com/300x400',
            imageThumbPath: newImageThumbPath,
          },
        ];
      }
      const result = await updateSiteData({ ...siteData, team: updatedTeam });
      if (!result.ok) {
        showSyncWarning(toast);
      } else {
        toast({ title: 'Sucesso!', description: `Membro ${currentItem ? 'atualizado' : 'adicionado'}.` });
      }

      if (imageFile?.preview) {
        URL.revokeObjectURL(imageFile.preview);
      }
      setIsDialogOpen(false);
      setCurrentItem(null);
      setImageFile(null);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error?.message || 'Falha ao salvar a equipe.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const itemToDelete = siteData.team.find((t) => t.id === id);
    if ((itemToDelete?.imagePath || itemToDelete?.imageThumbPath) && isSupabaseReady) {
      try {
        await deleteStoragePaths([itemToDelete.imagePath, itemToDelete.imageThumbPath].filter(Boolean));
      } catch (error) {
        toast({ title: 'Aviso', description: 'Não foi possível remover a imagem do storage.' });
      }
    }
    if (itemToDelete?.image && itemToDelete.image.startsWith('blob:')) {
      URL.revokeObjectURL(itemToDelete.image);
    }
    const updatedTeam = siteData.team.filter((t) => t.id !== id);
    const result = await updateSiteData({ ...siteData, team: updatedTeam });
    if (!result.ok) {
      showSyncWarning(toast);
    } else {
      toast({ title: 'Sucesso!', description: 'Membro da equipe removido.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gerenciar Adm. Paroquial</h3>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Membro
        </Button>
      </div>
      <div className="space-y-4">
        <AnimatePresence>
          {siteData.team.map((item) => (
            <CrudItem key={item.id} item={item} onEdit={openDialog} onDelete={handleDelete}>
              <div className="flex items-center gap-4">
                <img
                  src={item.imageThumb || item.image}
                  alt={item.name}
                  className="w-12 h-16 object-cover rounded-md bg-gray-200"
                />
                <div>
                  <p className="font-semibold text-gray-800">{item.name}</p>
                  <p className="text-sm text-gray-500">{item.role}</p>
                </div>
              </div>
            </CrudItem>
          ))}
        </AnimatePresence>
      </div>
      <Dialog
        open={isDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsDialogOpen(false);
            setCurrentItem(null);
            setImageFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentItem ? 'Editar' : 'Adicionar'} Membro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" defaultValue={currentItem?.name} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role">Função</Label>
              <Input id="role" name="role" defaultValue={currentItem?.role} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact">Contato</Label>
              <Input id="contact" name="contact" defaultValue={currentItem?.contact} />
            </div>

            <div>
              <Label>Foto</Label>
              <div
                {...getRootProps()}
                className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500"
              >
                <input {...getInputProps()} />
                <UploadCloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                {isDragActive ? <p>Solte a foto aqui...</p> : <p>Arraste uma foto ou clique para selecionar</p>}
                <p className="text-xs text-gray-500 mt-1">Recomendação: proporção 3:4</p>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <div>
                  <p className="text-sm font-semibold">Foto Atual:</p>
                  <img
                    src={currentItem?.imageThumb || currentItem?.image || 'https://via.placeholder.com/300x400'}
                    alt="Atual"
                    className="w-24 h-32 object-cover rounded bg-gray-200 mt-1"
                  />
                </div>
                {imageFile && (
                  <div>
                    <p className="text-sm font-semibold">Nova Foto:</p>
                    <img src={imageFile.preview} alt="Nova" className="w-24 h-32 object-cover rounded bg-gray-200 mt-1" />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
// #endregion

// #region SettingsContactAbout
const SettingsContactAbout = () => {
  const { siteData, updateSiteData } = useData();
  const { toast } = useToast();
  const [mapFile, setMapFile] = useState(null);
  const [removeMapImage, setRemoveMapImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const onMapDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles[0]) {
        if (mapFile?.preview) {
          URL.revokeObjectURL(mapFile.preview);
        }
        const file = acceptedFiles[0];
        setMapFile(
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          })
        );
        setRemoveMapImage(false);
      }
    },
    [mapFile]
  );

  const {
    getRootProps: getMapRootProps,
    getInputProps: getMapInputProps,
    isDragActive: isMapDragActive,
  } = useDropzone({
    onDrop: onMapDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    if (mapFile && !isSupabaseReady) {
      toast({
        title: 'Erro',
        description: 'Supabase não configurado para upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      let mapImageUrl = siteData.contact.mapImageUrl || null;
      let mapImagePath = siteData.contact.mapImagePath || null;

      if (mapFile) {
        const result = await uploadImageFile({ file: mapFile, folder: 'contact/map' });
        mapImageUrl = result.publicUrl;
        mapImagePath = result.path;

        if (siteData.contact.mapImagePath && siteData.contact.mapImagePath !== result.path) {
          try {
            await deleteStoragePaths([siteData.contact.mapImagePath]);
          } catch (error) {
            toast({ title: 'Aviso', description: 'Não foi possível remover a imagem anterior.' });
          }
        }
      }

      if (removeMapImage) {
        if (mapImagePath && isSupabaseReady) {
          try {
            await deleteStoragePaths([mapImagePath]);
          } catch (error) {
            toast({ title: 'Aviso', description: 'Não foi possível remover a imagem do mapa.' });
          }
        }
        mapImageUrl = null;
        mapImagePath = null;
      }

      const updatedData = {
        ...siteData,
        contact: {
          ...siteData.contact,
          address: formData.get('address'),
          mapLat: formData.get('mapLat'),
          mapLng: formData.get('mapLng'),
          mapImageUrl,
          mapImagePath,
          phone: formData.get('phone'),
          email: formData.get('email'),
          whatsapp: formData.get('whatsapp'),
          officeHours: formData.get('officeHours'),
          massSchedule: formData.get('massSchedule'),
          social: {
            facebook: formData.get('facebook'),
            instagram: formData.get('instagram'),
            youtube: formData.get('youtube'),
          },
        },
        about: {
          ...siteData.about,
          history: formData.get('history'),
          mission: formData.get('mission'),
          vision: formData.get('vision'),
          values: formData.get('values'),
          youtubeVideoUrl: formData.get('youtubeVideoUrl'),
        },
      };

      const result = await updateSiteData(updatedData);
      if (!result.ok) {
        showSyncWarning(toast);
      } else {
        toast({ title: 'Sucesso!', description: 'Informações atualizadas.' });
      }

      if (mapFile?.preview) {
        URL.revokeObjectURL(mapFile.preview);
      }
      setMapFile(null);
      setRemoveMapImage(false);
    } catch (error) {
      toast({
        title: 'Erro',
        description: error?.message || 'Falha ao salvar as informações.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Página "Quem Somos"</h3>
        <div className="space-y-1">
          <Label htmlFor="youtubeVideoUrl">Link do Vídeo do YouTube</Label>
          <Input id="youtubeVideoUrl" name="youtubeVideoUrl" defaultValue={siteData.about.youtubeVideoUrl} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="history">História</Label>
          <Textarea id="history" name="history" defaultValue={siteData.about.history} rows={5} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mission">Missão</Label>
          <Textarea id="mission" name="mission" defaultValue={siteData.about.mission} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vision">Visão</Label>
          <Textarea id="vision" name="vision" defaultValue={siteData.about.vision} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="values">Valores</Label>
          <Input id="values" name="values" defaultValue={siteData.about.values} />
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Informações de Contato</h3>
        <div className="space-y-1">
          <Label htmlFor="address">Endereço</Label>
          <Input id="address" name="address" defaultValue={siteData.contact.address} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="mapLat">Latitude (mapa)</Label>
            <Input id="mapLat" name="mapLat" defaultValue={siteData.contact.mapLat} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mapLng">Longitude (mapa)</Label>
            <Input id="mapLng" name="mapLng" defaultValue={siteData.contact.mapLng} />
          </div>
        </div>
        <div className="space-y-3">
          <Label>Imagem do Mapa (opcional)</Label>
          <div
            {...getMapRootProps()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
          >
            <input {...getMapInputProps()} />
            <UploadCloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            {isMapDragActive ? (
              <p>Solte a imagem aqui...</p>
            ) : (
              <p>Arraste e solte uma imagem aqui, ou clique para selecionar</p>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            {siteData.contact.mapImageUrl && !removeMapImage && (
              <div className="relative">
                <img
                  src={siteData.contact.mapImageUrl}
                  alt="Mapa atual"
                  className="h-32 w-48 object-cover rounded-md border"
                />
                <button
                  type="button"
                  onClick={() => setRemoveMapImage(true)}
                  className="absolute top-1 right-1 bg-white/90 text-red-600 rounded-full p-1 shadow-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            {mapFile && (
              <div className="relative">
                <img src={mapFile.preview} alt="Novo mapa" className="h-32 w-48 object-cover rounded-md border" />
                <button
                  type="button"
                  onClick={() => {
                    if (mapFile?.preview) {
                      URL.revokeObjectURL(mapFile.preview);
                    }
                    setMapFile(null);
                  }}
                  className="absolute top-1 right-1 bg-white/90 text-red-600 rounded-full p-1 shadow-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            {!siteData.contact.mapImageUrl && !mapFile && (
              <p className="text-sm text-gray-500">Nenhuma imagem cadastrada.</p>
            )}
          </div>
          {removeMapImage && (
            <p className="text-sm text-red-500">A imagem atual será removida ao salvar.</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" name="phone" defaultValue={siteData.contact.phone} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={siteData.contact.email} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="whatsapp">WhatsApp (somente números)</Label>
            <Input id="whatsapp" name="whatsapp" defaultValue={siteData.contact.whatsapp} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="officeHours">Horário de Atendimento</Label>
          <Textarea id="officeHours" name="officeHours" defaultValue={siteData.contact.officeHours} rows={3} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="massSchedule">Horários de Missas</Label>
          <Textarea
            id="massSchedule"
            name="massSchedule"
            defaultValue={siteData.contact.massSchedule || ''}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="facebook">URL do Facebook</Label>
            <Input id="facebook" name="facebook" defaultValue={siteData.contact.social.facebook} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="instagram">URL do Instagram</Label>
            <Input id="instagram" name="instagram" defaultValue={siteData.contact.social.instagram} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="youtube">URL do YouTube</Label>
            <Input id="youtube" name="youtube" defaultValue={siteData.contact.social.youtube} />
          </div>
        </div>
      </div>
      <Button type="submit">Salvar Todas as Alterações</Button>
    </form>
  );
};
// #endregion

const SiteSettings = () => {
  return (
    <>
      <Helmet>
        <title>Configurações do Site - Dashboard</title>
      </Helmet>
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Configurações do Site</h1>
        <Tabs defaultValue="contact" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 mb-6">
            <TabsTrigger value="homepage">Página Inicial</TabsTrigger>
            <TabsTrigger value="communities">Comunidades</TabsTrigger>
            <TabsTrigger value="pastorals">Pastorais</TabsTrigger>
            <TabsTrigger value="team">Adm. Paroquial</TabsTrigger>
            <TabsTrigger value="contact">Contato/Sobre</TabsTrigger>
          </TabsList>

          <div className="p-6 bg-white rounded-lg shadow-md">
            <TabsContent value="homepage">
              <SettingsHomePage />
            </TabsContent>
            <TabsContent value="communities">
              <SettingsCommunities />
            </TabsContent>
            <TabsContent value="pastorals">
              <SettingsPastorals />
            </TabsContent>
            <TabsContent value="team">
              <SettingsTeam />
            </TabsContent>
            <TabsContent value="contact">
              <SettingsContactAbout />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </>
  );
};

export default SiteSettings;

