"use client";
import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import {
  useGetFolders, useCreateFolder, useUpdateFolder, useDeleteFolder, getGetFoldersQueryKey,
  useGetTags, useCreateTag, useUpdateTag, useDeleteTag, getGetTagsQueryKey,
  useGetLinks,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
  FolderOpen, Tag as TagIcon, Plus, Trash2, Loader2, Check, Pencil, Link2,
  ChevronRight, X, FolderPlus, Hash,
} from "lucide-react";

const COLORS = [
  { hex: "#4F46E5", label: "Indigo" },
  { hex: "#3B82F6", label: "Blue" },
  { hex: "#06B6D4", label: "Cyan" },
  { hex: "#10B981", label: "Emerald" },
  { hex: "#84CC16", label: "Lime" },
  { hex: "#F59E0B", label: "Amber" },
  { hex: "#F97316", label: "Orange" },
  { hex: "#EF4444", label: "Red" },
  { hex: "#EC4899", label: "Pink" },
  { hex: "#8B5CF6", label: "Violet" },
];

const glassCard = {
  background: "rgba(17,24,39,0.65)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)",
  borderRadius: "20px",
} as const;

const glassSectionHeader = {
  background: "rgba(255,255,255,0.03)",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
} as const;

const gradientButton = {
  background: "linear-gradient(135deg, #818CF8, #A78BFA)",
  boxShadow: "0 2px 8px rgba(129,140,248,0.25)",
} as const;

const glassInput = {
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)",
  color: "#E2E8F0",
} as const;

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map(({ hex, label }) => (
        <button
          key={hex}
          type="button"
          title={label}
          onClick={() => onChange(hex)}
          className="w-7 h-7 rounded-[10px] flex items-center justify-center transition-all hover:scale-110 ring-offset-2"
          style={{
            backgroundColor: hex,
            boxShadow: value === hex ? `0 0 0 2px rgba(17,24,39,0.9), 0 0 0 4px ${hex}` : undefined,
          }}
        >
          {value === hex && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

function InlineRenameInput({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    const trimmed = val.trim();
    if (trimmed && trimmed !== initialValue) onSave(trimmed);
    else onCancel();
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") onCancel();
  };

  return (
    <input
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      className="flex-1 min-w-0 px-2 py-0.5 text-sm font-semibold rounded-[14px] outline-none focus:ring-2 focus:ring-[#818CF8]/20"
      style={{ border: "1px solid #818CF8", background: "rgba(17,24,39,0.9)", color: "#E2E8F0" }}
    />
  );
}

export default function Organize() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();

  const { data: folders = [], isLoading: foldersLoading } = useGetFolders();
  const { data: tags = [], isLoading: tagsLoading } = useGetTags();
  const { data: links = [] } = useGetLinks();

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  // Folder form
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState(COLORS[0].hex);

  // Tag form
  const [showTagForm, setShowTagForm] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState(COLORS[9].hex);

  // Inline rename state
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);

  // Computed counts from links
  const folderCounts = (links as any[]).reduce<Record<string, number>>((acc, link) => {
    if (link.folderId) acc[link.folderId] = (acc[link.folderId] ?? 0) + 1;
    return acc;
  }, {});

  // --- Folder actions ---
  const handleCreateFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    try {
      await createFolder.mutateAsync({ data: { name: folderName.trim(), color: folderColor } });
      queryClient.invalidateQueries({ queryKey: getGetFoldersQueryKey() });
      toast({ title: "Folder created" });
      setFolderName("");
      setShowFolderForm(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    setRenamingFolderId(null);
    try {
      await updateFolder.mutateAsync({ id, data: { name } });
      queryClient.invalidateQueries({ queryKey: getGetFoldersQueryKey() });
      toast({ title: "Folder renamed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Links inside will remain but lose their folder assignment.`)) return;
    try {
      await deleteFolder.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetFoldersQueryKey() });
      toast({ title: "Folder deleted" });
    } catch {
      toast({ title: "Error deleting folder", variant: "destructive" });
    }
  };

  // --- Tag actions ---
  const handleCreateTag = async (e: FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;
    try {
      await createTag.mutateAsync({ data: { name: tagName.trim(), color: tagColor } });
      queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
      toast({ title: "Tag created" });
      setTagName("");
      setShowTagForm(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRenameTag = async (id: string, name: string) => {
    setRenamingTagId(null);
    try {
      await updateTag.mutateAsync({ id, data: { name } });
      queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
      toast({ title: "Tag renamed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    if (!confirm(`Delete tag "${name}"? It will be removed from all links.`)) return;
    try {
      await deleteTag.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
      toast({ title: "Tag deleted" });
    } catch {
      toast({ title: "Error deleting tag", variant: "destructive" });
    }
  };

  const totalLinks = (links as any[]).length;

  return (
    <ProtectedLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)", boxShadow: "0 4px 12px rgba(129,140,248,0.25)" }}
          >
            <FolderOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-[#F1F5F9] tracking-tight font-[family-name:var(--font-space-grotesk)]">Organize</h1>
            <p className="text-[#94A3B8] mt-0.5">
              Group your {totalLinks > 0 ? totalLinks : ""} links with folders and tags for easier management.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

          {/* -- Folders -- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(129,140,248,0.12)" }}
                >
                  <FolderOpen className="w-4 h-4 text-[#818CF8]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#F1F5F9]">Folders</h2>
                  <p className="text-xs text-[#64748B]">{(folders as any[]).length} folder{(folders as any[]).length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowFolderForm(true); setRenamingFolderId(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                style={gradientButton}
              >
                <Plus className="w-3.5 h-3.5" /> New Folder
              </button>
            </div>

            {/* Create form */}
            {showFolderForm && (
              <div className="rounded-[20px] p-4 space-y-4" style={glassCard}>
                <form onSubmit={handleCreateFolder} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Folder name</label>
                    <input
                      autoFocus
                      placeholder="e.g. Marketing, Social Media..."
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#818CF8]/20 focus:border-[#818CF8] transition"
                      style={glassInput}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#64748B] mb-2 block">Color</label>
                    <ColorPicker value={folderColor} onChange={setFolderColor} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={!folderName.trim() || createFolder.isPending}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all flex items-center justify-center gap-2 hover:opacity-90"
                      style={gradientButton}
                    >
                      {createFolder.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Create Folder
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFolderForm(false)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-[#64748B] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Folder list */}
            <div className="rounded-[20px] overflow-hidden" style={glassCard}>
              {foldersLoading ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#64748B]" />
                </div>
              ) : (folders as any[]).length === 0 ? (
                <div className="py-14 flex flex-col items-center gap-3 text-center px-6">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(129,140,248,0.12)" }}
                  >
                    <FolderPlus className="w-6 h-6 text-[#818CF8]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#F1F5F9]">No folders yet</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">Create your first folder to group related links.</p>
                  </div>
                  <button
                    onClick={() => setShowFolderForm(true)}
                    className="mt-1 text-xs font-semibold text-[#818CF8] hover:text-[#A78BFA] transition-colors"
                  >
                    + Create a folder
                  </button>
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  {(folders as any[]).map((folder) => {
                    const count = folderCounts[folder.id] ?? 0;
                    const isRenaming = renamingFolderId === folder.id;
                    return (
                      <li
                        key={folder.id}
                        className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        {/* Color swatch / icon */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                          style={{ backgroundColor: `${folder.color}18` }}
                        >
                          <FolderOpen className="w-4.5 h-4.5" style={{ color: folder.color }} />
                        </div>

                        {/* Name + count */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {isRenaming ? (
                            <InlineRenameInput
                              initialValue={folder.name}
                              onSave={(name) => handleRenameFolder(folder.id, name)}
                              onCancel={() => setRenamingFolderId(null)}
                            />
                          ) : (
                            <>
                              <span className="text-sm font-semibold text-[#F1F5F9] truncate">{folder.name}</span>
                              <span
                                className="text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: `${folder.color}15`, color: folder.color }}
                              >
                                {count} {count === 1 ? "link" : "links"}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Actions */}
                        {!isRenaming && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => router.push(`/links?folder=${folder.id}`)}
                              title="View links in this folder"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#818CF8] hover:bg-[rgba(129,140,248,0.12)] transition-colors"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setRenamingFolderId(folder.id)}
                              title="Rename folder"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#818CF8] hover:bg-[rgba(129,140,248,0.12)] transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFolder(folder.id, folder.name)}
                              title="Delete folder"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* -- Tags -- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(129,140,248,0.12)" }}
                >
                  <TagIcon className="w-4 h-4 text-[#818CF8]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#F1F5F9]">Tags</h2>
                  <p className="text-xs text-[#64748B]">{(tags as any[]).length} tag{(tags as any[]).length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowTagForm(true); setRenamingTagId(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                style={gradientButton}
              >
                <Plus className="w-3.5 h-3.5" /> New Tag
              </button>
            </div>

            {/* Create tag form */}
            {showTagForm && (
              <div className="rounded-[20px] p-4 space-y-4" style={glassCard}>
                <form onSubmit={handleCreateTag} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-[#64748B] mb-1.5 block">Tag name</label>
                    <input
                      autoFocus
                      placeholder="e.g. campaign, product-launch..."
                      value={tagName}
                      onChange={(e) => setTagName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#818CF8]/20 focus:border-[#818CF8] transition"
                      style={glassInput}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#64748B] mb-2 block">Color</label>
                    <ColorPicker value={tagColor} onChange={setTagColor} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={!tagName.trim() || createTag.isPending}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all flex items-center justify-center gap-2 hover:opacity-90"
                      style={gradientButton}
                    >
                      {createTag.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Create Tag
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTagForm(false)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-[#64748B] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tag list */}
            <div className="rounded-[20px] overflow-hidden" style={glassCard}>
              {tagsLoading ? (
                <div className="py-16 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#64748B]" />
                </div>
              ) : (tags as any[]).length === 0 ? (
                <div className="py-14 flex flex-col items-center gap-3 text-center px-6">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(129,140,248,0.12)" }}
                  >
                    <Hash className="w-6 h-6 text-[#818CF8]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#F1F5F9]">No tags yet</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">Tags let you label links across different folders.</p>
                  </div>
                  <button
                    onClick={() => setShowTagForm(true)}
                    className="mt-1 text-xs font-semibold text-[#818CF8] hover:text-[#A78BFA] transition-colors"
                  >
                    + Create a tag
                  </button>
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  {(tags as any[]).map((tag) => {
                    const isRenaming = renamingTagId === tag.id;
                    return (
                      <li
                        key={tag.id}
                        className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        {/* Color dot */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${tag.color}18` }}
                        >
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {isRenaming ? (
                            <InlineRenameInput
                              initialValue={tag.name}
                              onSave={(name) => handleRenameTag(tag.id, name)}
                              onCancel={() => setRenamingTagId(null)}
                            />
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full"
                              style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                            >
                              # {tag.name}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        {!isRenaming && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => router.push(`/links?tag=${tag.id}`)}
                              title="View links with this tag"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#818CF8] hover:bg-[rgba(129,140,248,0.12)] transition-colors"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setRenamingTagId(tag.id)}
                              title="Rename tag"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#818CF8] hover:bg-[rgba(129,140,248,0.12)] transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag.id, tag.name)}
                              title="Delete tag"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

        </div>

        {/* Tips section */}
        <div className="rounded-[20px] p-5" style={glassCard}>
          <p className="text-xs font-semibold text-[#818CF8] uppercase tracking-wider mb-3">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: <FolderOpen className="w-4 h-4 text-[#818CF8]" />,
                title: "One folder per link",
                body: "Each link belongs to a single folder. Use folders for broad categories like campaigns or clients.",
              },
              {
                icon: <TagIcon className="w-4 h-4 text-[#818CF8]" />,
                title: "Multiple tags per link",
                body: "Links can have many tags. Use tags for cross-cutting concerns like channel, status, or priority.",
              },
              {
                icon: <ChevronRight className="w-4 h-4 text-[#818CF8]" />,
                title: "Filter in Links",
                body: "Click the link icon on any folder or tag to jump straight to a filtered view in your Links page.",
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F1F5F9]">{title}</p>
                  <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}
