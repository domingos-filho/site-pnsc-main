import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, ImagePlus, X, UploadCloud, ArrowLeft, ArrowRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useData } from '@/contexts/DataContext';
import { normalizeGallery } from '@/lib/gallery';
import {
  createGalleryCollection,
  createGalleryMediaBatch,
  deleteGalleryCollection,
  deleteGalleryMedia,
  loadGalleryCollections,
  reorderGalleryMedia,
  setGalleryCollectionCover,
  updateGalleryCollection,
} from '@/lib/galleryData';
import { deleteStoragePaths, isSupabaseReady, uploadImageFile } from '@/lib/supabaseStorage';

const showLegacySyncWarning = (toast) => {
  toast({
    title: 'Aviso',
    description: 'Galeria salva apenas no modo legado. Configure o Supabase para usar a galeria relacional.',
  });
};

const formatErrorMessage = (error, fallbackMessage) => error?.message || fallbackMessage;

const GALLERY_UPLOAD_OPTIONS = {
  storeOriginal: false,
  generateThumbnail: true,
  thumbnailMaxWidth: 480,
  thumbnailMaxHeight: 480,
  thumbnailQuality: 0.8,
  generateMedium: true,
  mediumMaxWidth: 1600,
  mediumMaxHeight: 1600,
  mediumQuality: 0.86,
};

const uniqueStoragePaths = (paths = []) => [...new Set(paths.filter(Boolean))];

const moveArrayItem = (items, fromIndex, toIndex) => {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
};

const ManageGallery = () => {
  const { toast } = useToast();
  const { siteData, updateSiteData } = useData();
  const [albums, setAlbums] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [isAlbumDialogOpen, setIsAlbumDialogOpen] = useState(false);
  const [isPhotosDialogOpen, setIsPhotosDialogOpen] = useState(false);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingAlbum, setIsSavingAlbum] = useState(false);
  const [isUsingLegacyFallback, setIsUsingLegacyFallback] = useState(!isSupabaseReady);

  const legacyAlbums = useMemo(() => normalizeGallery(siteData.gallery), [siteData.gallery]);

  useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file?.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  const persistLegacyGallery = useCallback(
    async (updatedGallery, successMessage) => {
      const result = await updateSiteData({
        ...siteData,
        gallery: updatedGallery,
      });

      const normalizedGallery = normalizeGallery(updatedGallery);
      setAlbums(normalizedGallery);
      setIsUsingLegacyFallback(true);

      if (!result.ok) {
        showLegacySyncWarning(toast);
      } else if (successMessage) {
        toast({ title: 'Sucesso!', description: successMessage });
      }

      return result;
    },
    [siteData, toast, updateSiteData]
  );

  const loadAlbums = useCallback(async () => {
    if (!isSupabaseReady) {
      setAlbums(legacyAlbums);
      setIsUsingLegacyFallback(true);
      setLoadingAlbums(false);
      return;
    }

    setLoadingAlbums(true);

    try {
      const remoteAlbums = await loadGalleryCollections();

      if (remoteAlbums.length === 0 && legacyAlbums.length > 0) {
        setAlbums(legacyAlbums);
        setIsUsingLegacyFallback(true);
      } else {
        setAlbums(remoteAlbums);
        setIsUsingLegacyFallback(false);
      }
    } catch (error) {
      console.error('Falha ao carregar galeria relacional', error);
      setAlbums(legacyAlbums);
      setIsUsingLegacyFallback(true);
      toast({
        title: 'Aviso',
        description: 'Falha ao carregar a galeria relacional. Exibindo dados legados.',
      });
    } finally {
      setLoadingAlbums(false);
    }
  }, [legacyAlbums, toast]);

  useEffect(() => {
    void loadAlbums();
  }, [loadAlbums]);

  const openAlbumDialog = (album = null) => {
    setCurrentAlbum(album);
    setIsAlbumDialogOpen(true);
  };

  const closeAlbumDialog = () => {
    setCurrentAlbum(null);
    setIsAlbumDialogOpen(false);
  };

  const openPhotosDialog = (album) => {
    setCurrentAlbum(album);
    setFiles([]);
    setIsPhotosDialogOpen(true);
  };

  const closePhotosDialog = () => {
    files.forEach((file) => {
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
    setCurrentAlbum(null);
    setIsPhotosDialogOpen(false);
  };

  const onDrop = useCallback((acceptedFiles) => {
    const imageFiles = acceptedFiles.filter((file) => file.type.startsWith('image/'));
    const previewFiles = imageFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setFiles((currentFiles) => [...currentFiles, ...previewFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
  });

  const removeFile = (fileToRemove) => {
    setFiles((currentFiles) => currentFiles.filter((file) => file !== fileToRemove));
    if (fileToRemove?.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  const handleSaveAlbum = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const albumData = {
      title: String(formData.get('title') || '').trim(),
      year: String(formData.get('year') || '').trim(),
      community: String(formData.get('community') || '').trim(),
    };

    if (!albumData.title) {
      toast({ title: 'Erro', description: 'Informe o nome do álbum.', variant: 'destructive' });
      return;
    }

    if (!albumData.year) {
      toast({ title: 'Erro', description: "O campo 'Ano' é obrigatório.", variant: 'destructive' });
      return;
    }

    if (isUsingLegacyFallback) {
      if (currentAlbum?.id) {
        const updatedAlbums = albums.map((album) =>
          album.id === currentAlbum.id ? { ...album, ...albumData } : album
        );
        await persistLegacyGallery(updatedAlbums, 'Álbum atualizado.');
      } else {
        const newAlbum = {
          id: `album-${Date.now()}`,
          ...albumData,
          images: [],
        };
        await persistLegacyGallery([...albums, newAlbum], 'Álbum criado.');
      }

      closeAlbumDialog();
      return;
    }

    setIsSavingAlbum(true);

    try {
      if (currentAlbum?.id) {
        await updateGalleryCollection(currentAlbum.id, albumData);
      } else {
        await createGalleryCollection(albumData);
      }

      await loadAlbums();
      closeAlbumDialog();
      toast({
        title: 'Sucesso!',
        description: `Álbum ${currentAlbum ? 'atualizado' : 'criado'}.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatErrorMessage(error, 'Falha ao salvar álbum.'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingAlbum(false);
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    const albumToDelete = albums.find((album) => album.id === albumId);
    if (!albumToDelete) return;

    if (isUsingLegacyFallback) {
      const storagePaths = uniqueStoragePaths(
        (albumToDelete.images || []).flatMap((photo) => [photo.path, photo.thumbPath, photo.mediumPath])
      );

      if (storagePaths.length > 0 && isSupabaseReady) {
        try {
          await deleteStoragePaths(storagePaths);
        } catch (error) {
          toast({ title: 'Aviso', description: 'Não foi possível remover arquivos do storage.' });
        }
      }

      const updatedAlbums = albums.filter((album) => album.id !== albumId);
      await persistLegacyGallery(updatedAlbums, 'Álbum e fotos removidos.');
      return;
    }

    const storagePaths = uniqueStoragePaths(
      (albumToDelete.images || []).flatMap((photo) => [photo.path, photo.thumbPath, photo.mediumPath])
    );

    if (storagePaths.length > 0) {
      try {
        await deleteStoragePaths(storagePaths);
      } catch (error) {
        toast({ title: 'Aviso', description: 'Não foi possível remover arquivos do storage.' });
      }
    }

    try {
      await deleteGalleryCollection(albumId);
      await loadAlbums();
      toast({ title: 'Sucesso!', description: 'Álbum e fotos removidos.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatErrorMessage(error, 'Falha ao excluir álbum.'),
        variant: 'destructive',
      });
    }
  };

  const handleUploadPhotos = async () => {
    if (!currentAlbum || files.length === 0) return;

    if (!isSupabaseReady) {
      toast({ title: 'Erro', description: 'Supabase não configurado para upload.', variant: 'destructive' });
      return;
    }

    if (isUsingLegacyFallback) {
      setIsUploading(true);
      try {
        const uploadResults = await Promise.allSettled(
          files.map((file) =>
            uploadImageFile({
              file,
              folder: `gallery/${currentAlbum.id}`,
              ...GALLERY_UPLOAD_OPTIONS,
            })
          )
        );

        const uploadedFiles = [];
        const failedFiles = [];

        uploadResults.forEach((result, index) => {
          const file = files[index];
          if (result.status === 'fulfilled') {
            uploadedFiles.push({ file, upload: result.value });
            if (file?.preview) {
              URL.revokeObjectURL(file.preview);
            }
          } else {
            failedFiles.push(file);
          }
        });

        if (uploadedFiles.length === 0) {
          const firstError = uploadResults.find((result) => result.status === 'rejected')?.reason;
          throw new Error(firstError?.message || 'Falha ao enviar imagens.');
        }

        const albumToUpdate = albums.find((album) => album.id === currentAlbum.id);
        const existingCount = albumToUpdate?.images.length || 0;
        const baseId = Date.now();
        const newImages = uploadedFiles.map(({ file, upload }, index) => ({
          id: `${currentAlbum.id}-image-${baseId + index}`,
          src: upload.mediumUrl || upload.publicUrl,
          mediumSrc: upload.mediumUrl || upload.publicUrl,
          thumbSrc: upload.thumbUrl || upload.mediumUrl || upload.publicUrl,
          path: upload.originalPath || null,
          mediumPath: upload.mediumPath || null,
          thumbPath: upload.thumbPath || null,
          alt: file?.name || `${currentAlbum.title} - Foto ${existingCount + index + 1}`,
        }));

        const updatedGallery = albums.map((album) =>
          album.id === currentAlbum.id
            ? { ...album, images: [...album.images, ...newImages] }
            : album
        );

        const saveResult = await persistLegacyGallery(
          updatedGallery,
          failedFiles.length === 0 ? `${newImages.length} fotos adicionadas ao álbum.` : ''
        );

        if (failedFiles.length > 0) {
          toast({ title: 'Aviso', description: `${failedFiles.length} imagens falharam no upload.` });
          setFiles(failedFiles);
        } else {
          closePhotosDialog();
        }

        if (!saveResult.ok && failedFiles.length === 0) {
          closePhotosDialog();
        }
      } catch (error) {
        toast({
          title: 'Erro',
          description: formatErrorMessage(error, 'Falha ao enviar imagens.'),
          variant: 'destructive',
        });
      } finally {
        setIsUploading(false);
      }

      return;
    }

    setIsUploading(true);

    try {
      const uploadResults = await Promise.allSettled(
        files.map((file) =>
          uploadImageFile({
            file,
            folder: `gallery/${currentAlbum.id}`,
            ...GALLERY_UPLOAD_OPTIONS,
          })
        )
      );

      const uploadedFiles = [];
      const failedFiles = [];

      uploadResults.forEach((result, index) => {
        const file = files[index];
        if (result.status === 'fulfilled') {
          uploadedFiles.push({ file, upload: result.value });
          if (file?.preview) {
            URL.revokeObjectURL(file.preview);
          }
        } else {
          failedFiles.push(file);
        }
      });

      if (uploadedFiles.length === 0) {
        const firstError = uploadResults.find((result) => result.status === 'rejected')?.reason;
        throw new Error(firstError?.message || 'Falha ao enviar imagens.');
      }

      const albumToUpdate = albums.find((album) => album.id === currentAlbum.id);
      const existingCount = albumToUpdate?.images.length || 0;

      try {
        await createGalleryMediaBatch(
          currentAlbum.id,
          uploadedFiles.map(({ file, upload }, index) => ({
            path: upload.originalPath || null,
            mediumPath: upload.mediumPath || null,
            thumbPath: upload.thumbPath || null,
            srcUrl: upload.mediumUrl || upload.publicUrl,
            thumbUrl: upload.thumbUrl || upload.mediumUrl || upload.publicUrl,
            altText: file?.name || `${currentAlbum.title} - Foto ${existingCount + index + 1}`,
            sortOrder: existingCount + index,
          }))
        );
      } catch (error) {
        await deleteStoragePaths(
          uniqueStoragePaths(
            uploadedFiles.flatMap(({ upload }) => [
              upload.originalPath,
              upload.path,
              upload.thumbPath,
              upload.mediumPath,
            ])
          )
        ).catch(() => {});
        throw error;
      }

      await loadAlbums();

      if (failedFiles.length > 0) {
        setFiles(failedFiles);
        toast({
          title: 'Aviso',
          description: `${uploadedFiles.length} foto(s) adicionadas. ${failedFiles.length} falharam no upload.`,
        });
      } else {
        closePhotosDialog();
        toast({
          title: 'Sucesso!',
          description: `${uploadedFiles.length} foto(s) adicionadas ao álbum.`,
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatErrorMessage(error, 'Falha ao enviar imagens.'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (albumId, photoId) => {
    const album = albums.find((item) => item.id === albumId);
    const photoToDelete = album?.images.find((photo) => photo.id === photoId);
    if (!photoToDelete) return;

    if (isUsingLegacyFallback) {
      if ((photoToDelete.path || photoToDelete.thumbPath || photoToDelete.mediumPath) && isSupabaseReady) {
        try {
          await deleteStoragePaths(
            uniqueStoragePaths([photoToDelete.path, photoToDelete.thumbPath, photoToDelete.mediumPath])
          );
        } catch (error) {
          toast({ title: 'Aviso', description: 'Não foi possível remover o arquivo do storage.' });
        }
      }

      const updatedGallery = albums.map((item) =>
        item.id === albumId
          ? { ...item, images: item.images.filter((photo) => photo.id !== photoId) }
          : item
      );
      await persistLegacyGallery(updatedGallery, 'Foto removida.');
      if (previewPhoto?.id === photoId) {
        setPreviewPhoto(null);
      }
      return;
    }

    let storageDeleteFailed = false;
    const storagePaths = uniqueStoragePaths([photoToDelete.path, photoToDelete.thumbPath, photoToDelete.mediumPath]);

    if (storagePaths.length > 0) {
      try {
        await deleteStoragePaths(storagePaths);
      } catch (error) {
        storageDeleteFailed = true;
      }
    }

    try {
      await deleteGalleryMedia(photoId);
      await loadAlbums();
      if (previewPhoto?.id === photoId) {
        setPreviewPhoto(null);
      }

      toast({
        title: storageDeleteFailed ? 'Aviso' : 'Sucesso!',
        description: storageDeleteFailed
          ? 'A foto foi removida da galeria, mas não foi possível excluir o arquivo do storage.'
          : 'Foto removida.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatErrorMessage(error, 'Falha ao excluir foto.'),
        variant: 'destructive',
      });
    }
  };

  const handleSetCoverPhoto = async (albumId, photoId) => {
    const album = albums.find((item) => item.id === albumId);
    if (!album || album.coverMediaId === photoId) return;

    if (isUsingLegacyFallback) {
      const updatedGallery = albums.map((item) =>
        item.id === albumId ? { ...item, coverMediaId: photoId } : item
      );
      await persistLegacyGallery(updatedGallery, 'Capa do álbum atualizada.');
      return;
    }

    try {
      await setGalleryCollectionCover(albumId, photoId);
      await loadAlbums();
      toast({ title: 'Sucesso!', description: 'Capa do álbum atualizada.' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatErrorMessage(error, 'Falha ao definir capa do álbum.'),
        variant: 'destructive',
      });
    }
  };

  const handleMovePhoto = async (albumId, photoId, direction) => {
    const album = albums.find((item) => item.id === albumId);
    if (!album) return;

    const currentIndex = album.images.findIndex((photo) => photo.id === photoId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= album.images.length) {
      return;
    }

    if (isUsingLegacyFallback) {
      const updatedGallery = albums.map((item) =>
        item.id === albumId
          ? { ...item, images: moveArrayItem(item.images, currentIndex, nextIndex) }
          : item
      );
      await persistLegacyGallery(updatedGallery, 'Ordem das fotos atualizada.');
      return;
    }

    try {
      const orderedIds = moveArrayItem(
        album.images.map((photo) => photo.id),
        currentIndex,
        nextIndex
      );
      await reorderGalleryMedia(albumId, orderedIds);
      await loadAlbums();
    } catch (error) {
      toast({
        title: 'Erro',
        description: formatErrorMessage(error, 'Falha ao reordenar fotos.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Gerenciar Galeria - Paróquia de Nossa Senhora da Conceição</title>
      </Helmet>

      <div className="container mx-auto p-4 md:p-8">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold">Gerenciar Galeria</h1>
          <Dialog
            open={isAlbumDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeAlbumDialog();
              } else {
                setIsAlbumDialogOpen(true);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => openAlbumDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Álbum
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{currentAlbum ? 'Editar Álbum' : 'Adicionar Novo Álbum'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveAlbum} className="space-y-4">
                <div>
                  <Label htmlFor="title">Nome do Álbum</Label>
                  <Input id="title" name="title" defaultValue={currentAlbum?.title} required />
                </div>
                <div>
                  <Label htmlFor="year">Ano</Label>
                  <Input
                    id="year"
                    name="year"
                    type="number"
                    defaultValue={currentAlbum?.year || new Date().getFullYear()}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="community">Comunidade</Label>
                  <Input id="community" name="community" defaultValue={currentAlbum?.community} />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary" onClick={closeAlbumDialog}>
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSavingAlbum}>
                    {isSavingAlbum ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isUsingLegacyFallback && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            A galeria relacional não está sendo usada neste momento. O painel está exibindo o modo legado.
          </div>
        )}

        {loadingAlbums ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">Carregando galeria...</div>
        ) : (
          <div className="space-y-8">
            {albums.map((album) => (
              <motion.div key={album.id} layout className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {album.title} ({album.year})
                    </h2>
                    {album.community && <p className="text-sm text-gray-500">{album.community}</p>}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openPhotosDialog(album)}>
                      <ImagePlus className="h-4 w-4 mr-2" />
                      Adicionar Fotos
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openAlbumDialog(album)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso excluirá o álbum e TODAS as suas fotos. Essa ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteAlbum(album.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Sim, excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <AnimatePresence>
                    {album.images.map((photo, index) => (
                      <motion.div
                        key={photo.id}
                        layout
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="rounded-lg border border-gray-100 bg-white p-2 shadow-sm"
                      >
                        <button
                          type="button"
                          className="block w-full cursor-zoom-in"
                          onClick={() => setPreviewPhoto(photo)}
                        >
                          <img
                            src={photo.thumbSrc || photo.src}
                            className="w-full h-32 object-contain bg-white rounded-md"
                            alt={photo.alt || album.title}
                          />
                        </button>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              photo.isCover ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {photo.isCover ? 'Capa' : 'Foto'}
                          </span>

                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === 0}
                              onClick={() => handleMovePhoto(album.id, photo.id, -1)}
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === album.images.length - 1}
                              onClick={() => handleMovePhoto(album.id, photo.id, 1)}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant={photo.isCover ? 'default' : 'outline'}
                              size="icon"
                              onClick={() => handleSetCoverPhoto(album.id, photo.id)}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Não</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeletePhoto(album.id, photo.id)}>
                                    Sim
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {album.images.length === 0 && (
                  <p className="text-center text-gray-500 py-4">Nenhuma foto neste álbum. Adicione algumas!</p>
                )}
              </motion.div>
            ))}

            {albums.length === 0 && (
              <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                Nenhum álbum cadastrado ainda.
              </div>
            )}
          </div>
        )}

        <Dialog
          open={isPhotosDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closePhotosDialog();
            } else {
              setIsPhotosDialogOpen(true);
            }
          }}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Adicionar Fotos ao Álbum: {currentAlbum?.title}</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
              <div
                {...getRootProps()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors flex flex-col items-center justify-center"
              >
                <input {...getInputProps()} />
                <UploadCloud className="h-12 w-12 text-gray-400 mb-4" />
                {isDragActive ? (
                  <p>Solte as imagens aqui...</p>
                ) : (
                  <p>Arraste e solte as imagens aqui, ou clique para selecionar</p>
                )}
                <p className="text-xs text-gray-500 mt-2">As imagens serão salvas em versões thumb e média para web</p>
              </div>

              <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
                {files.length > 0 ? (
                  files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-100 p-2 rounded-md">
                      <div className="flex items-center space-x-2">
                        <img
                          src={file.preview}
                          alt={file.name}
                          className="h-12 w-12 rounded-md object-contain bg-white"
                        />
                        <span className="text-sm truncate w-48">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFile(file)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 p-8">Nenhuma imagem selecionada.</div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={closePhotosDialog} disabled={isUploading}>
                Cancelar
              </Button>
              <Button onClick={handleUploadPhotos} disabled={files.length === 0 || isUploading}>
                {isUploading ? 'Enviando...' : `Adicionar ${files.length} Foto(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(previewPhoto)}
          onOpenChange={(open) => {
            if (!open) setPreviewPhoto(null);
          }}
        >
          <DialogContent className="max-w-[95vw] w-auto p-2 bg-transparent border-none shadow-none">
            <DialogHeader className="sr-only">
              <DialogTitle>Visualizar foto</DialogTitle>
            </DialogHeader>
            {previewPhoto && (
              <img
                src={previewPhoto.mediumSrc || previewPhoto.src}
                alt={previewPhoto.alt || 'Foto ampliada'}
                className="max-h-[85vh] max-w-[95vw] object-contain rounded-md bg-white"
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default ManageGallery;
