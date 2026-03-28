"use client";
import { useState, type FormEvent } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { 
  useGetFolders, useCreateFolder, useUpdateFolder, useDeleteFolder, getGetFoldersQueryKey,
  useGetTags, useCreateTag, useUpdateTag, useDeleteTag, getGetTagsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FolderOpen, Tag as TagIcon, Plus, Trash2, Loader2, Check } from "lucide-react";
import type { Folder, Tag } from "@workspace/api-client-react";

const COLORS = ["#6366f1", "#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#8b5cf6"];

export default function Organize() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Folders State
  const { data: folders, isLoading: foldersLoading } = useGetFolders();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  
  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState(COLORS[0]);

  // Tags State
  const { data: tags, isLoading: tagsLoading } = useGetTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  
  const [tagFormOpen, setTagFormOpen] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState(COLORS[2]);

  // Handlers for Folders
  const handleCreateFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    try {
      await createFolder.mutateAsync({ data: { name: folderName, color: folderColor } });
      queryClient.invalidateQueries({ queryKey: getGetFoldersQueryKey() });
      toast({ title: "Folder created" });
      setFolderName("");
      setFolderFormOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Delete folder? Links inside will remain but lose their folder assignment.")) return;
    try {
      await deleteFolder.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetFoldersQueryKey() });
      toast({ title: "Folder deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  // Handlers for Tags
  const handleCreateTag = async (e: FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;
    try {
      await createTag.mutateAsync({ data: { name: tagName, color: tagColor } });
      queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
      toast({ title: "Tag created" });
      setTagName("");
      setTagFormOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm("Delete tag? It will be removed from all links.")) return;
    try {
      await deleteTag.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
      toast({ title: "Tag deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  return (
    <ProtectedLayout>
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-extrabold tracking-tight">Organize</h1>
          <p className="text-muted-foreground mt-1 text-lg">Categorize your links using folders and tags.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Folders Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-display font-bold flex items-center gap-2">
                <FolderOpen className="w-6 h-6 text-primary" /> Folders
              </h2>
              {!folderFormOpen && (
                <Button variant="outline" size="sm" onClick={() => setFolderFormOpen(true)} className="rounded-lg h-9">
                  <Plus className="w-4 h-4 mr-1" /> New Folder
                </Button>
              )}
            </div>

            {folderFormOpen && (
              <Card className="p-5 rounded-2xl border-primary/20 shadow-md">
                <form onSubmit={handleCreateFolder} className="space-y-4">
                  <Input 
                    autoFocus
                    placeholder="Folder Name" 
                    value={folderName} 
                    onChange={(e) => setFolderName(e.target.value)} 
                    className="rounded-xl h-11"
                  />
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-2 block">Color</label>
                    <div className="flex gap-2">
                      {COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFolderColor(c)}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                          style={{ backgroundColor: c }}
                        >
                          {folderColor === c && <Check className="w-4 h-4 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={!folderName.trim() || createFolder.isPending} className="rounded-xl flex-1">Save</Button>
                    <Button type="button" variant="ghost" onClick={() => setFolderFormOpen(false)} className="rounded-xl">Cancel</Button>
                  </div>
                </form>
              </Card>
            )}

            <Card className="p-2 rounded-2xl border-border shadow-sm min-h-[300px]">
              {foldersLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : !folders || folders.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">No folders created.</div>
              ) : (
                <div className="space-y-1">
                  {folders.map(folder => (
                    <div key={folder.id} className="group flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-background border shadow-sm" style={{ borderColor: `${folder.color}30` }}>
                          <FolderOpen className="w-5 h-5" style={{ color: folder.color }} />
                        </div>
                        <span className="font-semibold text-foreground">{folder.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" onClick={() => handleDeleteFolder(folder.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Tags Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-display font-bold flex items-center gap-2">
                <TagIcon className="w-6 h-6 text-primary" /> Tags
              </h2>
              {!tagFormOpen && (
                <Button variant="outline" size="sm" onClick={() => setTagFormOpen(true)} className="rounded-lg h-9">
                  <Plus className="w-4 h-4 mr-1" /> New Tag
                </Button>
              )}
            </div>

            {tagFormOpen && (
              <Card className="p-5 rounded-2xl border-primary/20 shadow-md">
                <form onSubmit={handleCreateTag} className="space-y-4">
                  <Input 
                    autoFocus
                    placeholder="Tag Name" 
                    value={tagName} 
                    onChange={(e) => setTagName(e.target.value)} 
                    className="rounded-xl h-11"
                  />
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-2 block">Color</label>
                    <div className="flex gap-2">
                      {COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTagColor(c)}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                          style={{ backgroundColor: c }}
                        >
                          {tagColor === c && <Check className="w-4 h-4 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={!tagName.trim() || createTag.isPending} className="rounded-xl flex-1">Save</Button>
                    <Button type="button" variant="ghost" onClick={() => setTagFormOpen(false)} className="rounded-xl">Cancel</Button>
                  </div>
                </form>
              </Card>
            )}

            <Card className="p-6 rounded-2xl border-border shadow-sm min-h-[300px]">
              {tagsLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : !tags || tags.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No tags created.</div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {tags.map(tag => (
                    <div 
                      key={tag.id} 
                      className="group flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-full border shadow-sm transition-colors bg-background"
                      style={{ borderColor: `${tag.color}40` }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="text-sm font-semibold pr-1">{tag.name}</span>
                      <button 
                        onClick={() => handleDeleteTag(tag.id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

        </div>
      </div>
    </ProtectedLayout>
  );
}
