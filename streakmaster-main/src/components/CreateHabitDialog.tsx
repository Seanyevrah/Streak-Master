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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, FolderPlus, Pencil, Trash2 } from "lucide-react";
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

interface CreateHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onHabitCreated?: () => void;
  editHabit?: any;
}

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const CreateHabitDialog = ({ open, onOpenChange, userId, onHabitCreated, editHabit }: CreateHabitDialogProps) => {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "weekdays">("daily");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [weeklyDay, setWeeklyDay] = useState<number>(1); // Default to Monday
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: "",
    name: ""
  });

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
    fetchCategories();
  }, [userId]);

  useEffect(() => {
    if (open && !editHabit) {
      setName("");
      setCategoryId("");
      setFrequency("daily");
      setWeekdays([1, 2, 3, 4, 5]);
      setWeeklyDay(1);
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate("");
    } else if (editHabit) {
      setName(editHabit.name || "");
      setCategoryId(editHabit.category_id || "");
      setFrequency(editHabit.frequency || "daily");
      setWeekdays(editHabit.weekdays || [1, 2, 3, 4, 5]);
      // For weekly habits, use the start date's day of week
      if (editHabit.frequency === 'weekly' && editHabit.start_date) {
        const startDate = new Date(editHabit.start_date);
        setWeeklyDay(startDate.getDay());
      } else {
        setWeeklyDay(1);
      }
      setStartDate(editHabit.start_date || "");
      setEndDate(editHabit.end_date || "");
    }
  }, [editHabit, open]);

  const toggleWeekday = (day: number) => {
    setWeekdays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value === "none" ? "" : value);
  };

  const handleFrequencyChange = (value: "daily" | "weekly" | "weekdays") => {
    setFrequency(value);
    // When switching to weekly, ensure start date is set to calculate the weekly day
    if (value === 'weekly' && startDate) {
      const date = new Date(startDate);
      setWeeklyDay(date.getDay());
    }
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    // When frequency is weekly, update the weekly day based on the start date
    if (frequency === 'weekly' && value) {
      const date = new Date(value);
      setWeeklyDay(date.getDay());
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;

    if (frequency === 'weekdays' && weekdays.length === 0) {
      toast.error("Please select at least one weekday");
      return;
    }

    if (!name.trim()) {
      toast.error("Please enter a habit name");
      return;
    }

    setLoading(true);

    try {
      const habitData = {
        user_id: userId,
        name: name.trim(),
        category_id: categoryId === "none" ? null : categoryId || null,
        frequency,
        weekdays: frequency === 'weekdays' ? weekdays : null,
        start_date: startDate || new Date().toISOString().split('T')[0],
        end_date: endDate || null,
      };

      if (editHabit) {
        const { error } = await supabase
          .from('habits')
          .update(habitData)
          .eq('id', editHabit.id);

        if (error) throw error;
        toast.success("Habit updated successfully!");
      } else {
        const { error } = await supabase
          .from('habits')
          .insert(habitData);

        if (error) throw error;
        toast.success("Habit created successfully!");
      }

      onOpenChange(false);
      onHabitCreated?.();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${editHabit ? 'update' : 'create'} habit`);
    } finally {
      setLoading(false);
    }
  };

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
    } catch (error: any) {
      toast.error(error.message || "Failed to delete category");
    } finally {
      setLoading(false);
    }
  };

  const getWeeklyDayLabel = (day: number) => {
    return WEEKDAYS.find(d => d.value === day)?.label || 'Monday';
  };

  const CategoryManagerContent = () => (
    <div className="space-y-4">
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

      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
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
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editHabit ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
            <DialogDescription>
              {editHabit ? 'Update your habit details' : 'Add a new habit to track and build your streak'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Habit Name</Label>
              <Input
                id="name"
                placeholder="e.g., Morning Workout"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category">Category</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCategoryManager(!showCategoryManager)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage
                </Button>
              </div>
              <Select value={categoryId || "none"} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showCategoryManager && <CategoryManagerContent />}

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency} onValueChange={handleFrequencyChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="weekdays">Weekdays Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {frequency === 'weekly' && (
              <div className="space-y-2">
                <Label>Weekly Day</Label>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium">
                    This habit will repeat every <span className="text-primary">{getWeeklyDayLabel(weeklyDay)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on your start date: {startDate || 'Not set'}
                  </p>
                </div>
              </div>
            )}

            {frequency === 'weekdays' && (
              <div className="space-y-2">
                <Label>Select Weekdays</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WEEKDAYS.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={weekdays.includes(day.value)}
                        onCheckedChange={() => toggleWeekday(day.value)}
                      />
                      <Label
                        htmlFor={`day-${day.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date (Optional)</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !name.trim()}
                className="flex-1 bg-gradient-primary"
              >
                {loading ? (editHabit ? "Updating..." : "Creating...") : (editHabit ? "Update Habit" : "Create Habit")}
              </Button>
            </div>
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