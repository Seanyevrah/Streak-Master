import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Trash2, FolderPlus, X, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onCategoriesChanged?: () => void;
}

export const CategoryManager = ({ open, onOpenChange, userId, onCategoriesChanged }: CategoryManagerProps) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: "",
    name: ""
  });
  const [loading, setLoading] = useState(false);

  const fetchCategories = async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    setCategories(data || []);
  };

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [userId, open]);

  const createCategory = async () => {
    if (!userId || !newCategoryName.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('categories')
        .insert({ user_id: userId, name: newCategoryName.trim() });

      if (error) throw error;

      toast.success("Category created successfully!");
      setNewCategoryName("");
      await fetchCategories();
      onCategoriesChanged?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to create category");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: editName.trim() })
        .eq('id', id);

      if (error) throw error;

      toast.success("Category renamed successfully!");
      setEditingId(null);
      await fetchCategories();
      onCategoriesChanged?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to rename category");
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Category deleted successfully!");
      setDeleteDialog({ open: false, id: "", name: "" });
      await fetchCategories();
      onCategoriesChanged?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete category");
    } finally {
      setLoading(false);
    }
  };

  // Mobile Sheet version
  const MobileView = () => (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Manage Categories</SheetTitle>
          <SheetDescription>
            Create, rename, or delete your habit categories
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-4">
          {/* Create Category */}
          <div className="space-y-2">
            <Label htmlFor="new-category">New Category</Label>
            <div className="flex gap-2">
              <Input
                id="new-category"
                placeholder="e.g., Fitness"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    createCategory();
                  }
                }}
                className="flex-1"
              />
              <Button 
                onClick={createCategory} 
                disabled={loading || !newCategoryName.trim()}
                size="icon"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderPlus className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Categories List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {categories.length === 0 ? (
              <div className="text-center py-8">
                <FolderPlus className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  No categories yet. Create your first one!
                </p>
              </div>
            ) : (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg"
                >
                  {editingId === cat.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveEdit(cat.id);
                          }
                          if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => saveEdit(cat.id)}
                          disabled={loading}
                          className="h-8 px-3"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="h-8 px-3"
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium text-sm">{cat.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(cat.id, cat.name)}
                        className="h-8 w-8"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteDialog({ open: true, id: cat.id, name: cat.name })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  // Desktop Dialog version
  const DesktopView = () => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card max-w-md lg:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
          <DialogDescription>
            Create, rename, or delete your habit categories
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create Category */}
          <div className="space-y-2">
            <Label htmlFor="new-category">New Category</Label>
            <div className="flex gap-2">
              <Input
                id="new-category"
                placeholder="e.g., Fitness"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    createCategory();
                  }
                }}
              />
              <Button 
                onClick={createCategory} 
                disabled={loading || !newCategoryName.trim()}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FolderPlus className="w-4 h-4 mr-2" />
                )}
                Add
              </Button>
            </div>
          </div>

          {/* Categories List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {categories.length === 0 ? (
              <div className="text-center py-8">
                <FolderPlus className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">
                  No categories yet. Create your first one above!
                </p>
              </div>
            ) : (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg"
                >
                  {editingId === cat.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveEdit(cat.id);
                          }
                          if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => saveEdit(cat.id)}
                        disabled={loading}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium">{cat.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(cat.id, cat.name)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteDialog({ open: true, id: cat.id, name: cat.name })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden">
        <MobileView />
      </div>
      
      {/* Desktop View */}
      <div className="hidden md:block">
        <DesktopView />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">Delete Category?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              Are you sure you want to delete "{deleteDialog.name}"? Habits in this category will become uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="mt-2 sm:mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCategory(deleteDialog.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};