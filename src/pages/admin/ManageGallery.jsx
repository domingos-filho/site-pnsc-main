import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit, Trash2, ImagePlus, X, UploadCloud } from 'lucide-react';
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
import { normalizeGallery, normalizeGalleryImage } from '@/lib/gallery';
import { deleteStoragePaths, isSupabaseReady, uploadImageFile } from '@/lib/supabaseStorage';

const showSyncWarning = (toast) => {
  toast({
    title: 'Aviso',
    description: 'Galeria salva localmente, mas nao foi possivel sincronizar com o Supabase.',
  });
};

const ManageGallery = () => {
  const { toast } = useToast();
  const { siteData, updateSiteData } = useData();
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [isAlbumDialogOpen, setIsAlbumDialogOpen] = useState(false);
  const [isPhotosDialogOpen, setIsPhotosDialogOpen] = useState(false);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const albums = normalizeGallery(siteData.gallery);

  useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file?.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  const persistGallery = async (updatedGallery, successMessage) => {
    const result = await updateSiteData({
      ...siteData,
      gallery: updatedGallery,
    });

    if (!result.ok) {
      showSyncWarning(toast);
    } else if (successMessage) {
      toast({ title: 'Sucesso!', description: successMessage });
    }

    return result;
  };

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

  const handleSaveAlbum = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const albumData = {
      title: String(formData.get('title') || '').trim(),
      year: String(formData.get('year') || '').trim(),
      community: String(formData.get('community') || '').trim(),
    };

    if (!albumData.title) {
      toast({ title: 'Erro', description: 'Informe o nome do album.', variant: 'destructive' });
      return;
    }

    if (!albumData.year) {
      toast({ title: 'Erro', description: "O campo 'Ano' e obrigatorio.", variant: 'destructive' });
      return;
    }

    if (currentAlbum?.id) {
      const updatedAlbums = albums.map((album) =>
        album.id === currentAlbum.id ? { ...album, ...albumData } : album
      );
      await persistGallery(updatedAlbums, 'Album atualizado.');
    } else {
      const newAlbum = {
        id: `album-${Date.now()}`,
        ...albumData,
        images: [],
      };
      await persistGallery([...albums, newAlbum], 'Album criado.');
    }

    closeAlbumDialog();
  };

  const handleDeleteAlbum = async (albumId) => {
    const albumToDelete = albums.find((album) => album.id === albumId);
    const storagePaths = (albumToDelete?.images || [])
      .flatMap((photo) => [photo.path, photo.thumbPath])
      .filter(Boolean);

    if (storagePaths.length > 0 && isSupabaseReady) {
      try {
        await deleteStoragePaths(storagePaths);
      } catch (error) {
        toast({ title: 'Aviso', description: 'Nao foi possivel remover arquivos do storage.' });
      }
    }

    const updatedAlbums = albums.filter((album) => album.id !== albumId);
    await persistGallery(updatedAlbums, 'Album e fotos removidos.');
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

  const handleUploadPhotos = async () => {
    if (!currentAlbum || files.length === 0) return;

    if (!isSupabaseReady) {
      toast({ title: 'Erro', description: 'Supabase nao configurado para upload.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const uploadResults = await Promise.allSettled(
        files.map((file) =>
          uploadImageFile({
            file,
            folder: `gallery/${currentAlbum.id}`,
            generateThumbnail: true,
            thumbnailMaxWidth: 900,
            thumbnailMaxHeight: 900,
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
        toast({
          title: 'Erro',
          description: firstError?.message || 'Falha ao enviar imagens.',
          variant: 'destructive',
        });
        return;
      }

      const albumToUpdate = albums.find((album) => album.id === currentAlbum.id);
      const existingCount = albumToUpdate?.images.length || 0;
      const baseId = Date.now();
      const newImages = uploadedFiles.map(({ file, upload }, index) =>
        normalizeGalleryImage(
          {
            id: `${currentAlbum.id}-image-${baseId + index}`,
            src: upload.publicUrl,
            thumbSrc: upload.thumbUrl || upload.publicUrl,
            path: upload.path,
            thumbPath: upload.thumbPath || null,
            alt: file?.name || `${currentAlbum.title} - Foto ${existingCount + index + 1}`,
          },
          currentAlbum.title,
          existingCount + index
        )
      );

      const updatedGallery = albums.map((album) =>
        album.id === currentAlbum.id
          ? { ...album, images: [...album.images, ...newImages] }
          : album
      );

      const saveResult = await persistGallery(
        updatedGallery,
        failedFiles.length === 0 ? `${newImages.length} fotos adicionadas ao album.` : ''
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
        description: error?.message || 'Falha ao enviar imagens.',
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

    if ((photoToDelete.path || photoToDelete.thumbPath) && isSupabaseReady) {
      try {
        await deleteStoragePaths([photoToDelete.path, photoToDelete.thumbPath].filter(Boolean));
      } catch (error) {
        toast({ title: 'Aviso', description: 'Nao foi possivel remover o arquivo do storage.' });
      }
    }

    const updatedGallery = albums.map((item) =>
      item.id === albumId
        ? { ...item, images: item.images.filter((photo) => photo.id !== photoId) }
        : item
    );
    await persistGallery(updatedGallery, 'Foto removida.');
  };

  return (
    <>
      <Helmet>
        <title>Gerenciar Galeria - Paroquia de Nossa Senhora da Conceicao</title>
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
                Novo Album
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{currentAlbum ? 'Editar Album' : 'Adicionar Novo Album'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveAlbum} className="space-y-4">
                <div>
                  <Label htmlFor="title">Nome do Album</Label>
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
                  <Button type="submit">Salvar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

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
                          Isso excluira o album e TODAS as suas fotos. Essa acao nao pode ser desfeita.
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
                  {album.images.map((photo) => (
                    <motion.div
                      key={photo.id}
                      layout
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="relative group cursor-zoom-in"
                      onClick={() => setPreviewPhoto(photo)}
                    >
                      <img
                        src={photo.thumbSrc || photo.src}
                        className="w-full h-32 object-contain bg-white rounded-md"
                        alt={photo.alt || album.title}
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Nao</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeletePhoto(album.id, photo.id)}>
                                Sim
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {album.images.length === 0 && (
                <p className="text-center text-gray-500 py-4">Nenhuma foto neste album. Adicione algumas!</p>
              )}
            </motion.div>
          ))}

          {albums.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              Nenhum album cadastrado ainda.
            </div>
          )}
        </div>

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
              <DialogTitle>Adicionar Fotos ao Album: {currentAlbum?.title}</DialogTitle>
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
                <p className="text-xs text-gray-500 mt-2">As imagens serao redimensionadas para web</p>
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
            {previewPhoto && (
              <img
                src={previewPhoto.src}
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
