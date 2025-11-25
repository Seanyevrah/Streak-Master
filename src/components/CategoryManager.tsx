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
import { Pencil, Trash2, FolderPlus } from "lucide-react";
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Create, rename, or delete your habit categories
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mb-6">
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
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No categories yet. Create your first one above!
              </p>
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
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.name}"? Habits in this category will become uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCategory(deleteDialog.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};