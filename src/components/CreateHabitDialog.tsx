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
import { Settings, FolderPlus, Pencil, Trash2, Loader2, Calendar } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface CreateHabitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onHabitCreated?: () => void;
  editHabit?: any;
}

const WEEKDAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export const CreateHabitDialog = ({ open, onOpenChange, userId, onHabitCreated, editHabit }: CreateHabitDialogProps) => {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "weekdays">("daily");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [weeklyDay, setWeeklyDay] = useState<number>(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [habitLoading, setHabitLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: "",
    name: ""
  });
  const [activeTab, setActiveTab] = useState("details");

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
      setActiveTab("details");
    } else if (editHabit) {
      setName(editHabit.name || "");
      setCategoryId(editHabit.category_id || "");
      setFrequency(editHabit.frequency || "daily");
      setWeekdays(editHabit.weekdays || [1, 2, 3, 4, 5]);
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
    if (value === 'weekly' && startDate) {
      const date = new Date(startDate);
      setWeeklyDay(date.getDay());
    }
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
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

    setHabitLoading(true);

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
      setHabitLoading(false);
    }
  };

  const createCategory = async () => {
    if (!userId || !newCategoryName.trim()) return;

    setCategoryLoading(true);
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
      setCategoryLoading(false);
    }
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;

    setCategoryLoading(true);
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
      setCategoryLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    setCategoryLoading(true);
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
      setCategoryLoading(false);
    }
  };

  const getWeeklyDayLabel = (day: number) => {
    return WEEKDAYS.find(d => d.value === day)?.label || 'Monday';
  };

  // Mobile Category Manager Sheet
  const MobileCategoryManager = () => (
    <Sheet open={showCategoryManager} onOpenChange={setShowCategoryManager}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Manage Categories</SheetTitle>
          <SheetDescription>
            Create, rename, or delete your habit categories
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-category">New Category</Label>
            <div className="flex gap-2">
              <Input
                id="new-category"
                placeholder="e.g., Fitness"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                disabled={categoryLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    createCategory();
                  }
                }}
              />
              <Button 
                onClick={createCategory} 
                disabled={categoryLoading || !newCategoryName.trim()}
                size="icon"
              >
                {categoryLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderPlus className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No categories yet. Create your first one!
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
                        className="flex-1 text-sm"
                        autoFocus
                        disabled={categoryLoading}
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
                        disabled={categoryLoading}
                      >
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-medium text-sm">{cat.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(cat.id, cat.name)}
                        className="h-8 w-8"
                        disabled={categoryLoading}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteDialog({ open: true, id: cat.id, name: cat.name })}
                        disabled={categoryLoading}
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

  // Desktop Category Manager (inline)
  const DesktopCategoryManager = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-category">New Category</Label>
        <div className="flex gap-2">
          <Input
            id="new-category"
            placeholder="e.g., Fitness"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            disabled={categoryLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                createCategory();
              }
            }}
          />
          <Button 
            onClick={createCategory} 
            disabled={categoryLoading || !newCategoryName.trim()}
          >
            {categoryLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FolderPlus className="w-4 h-4 mr-2" />
            )}
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
                    disabled={categoryLoading}
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
                    disabled={categoryLoading}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    disabled={categoryLoading}
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
                    disabled={categoryLoading}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteDialog({ open: true, id: cat.id, name: cat.name })}
                    disabled={categoryLoading}
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

  // Mobile weekday selector
  const MobileWeekdaySelector = () => (
    <div className="space-y-2">
      <Label>Select Weekdays</Label>
      <div className="grid grid-cols-3 gap-2">
        {WEEKDAYS.map((day) => (
          <Button
            key={day.value}
            variant={weekdays.includes(day.value) ? "default" : "outline"}
            size="sm"
            className="h-12 flex-col gap-1 text-xs"
            onClick={() => toggleWeekday(day.value)}
          >
            <span className="text-xs">{day.short}</span>
            {weekdays.includes(day.value) && (
              <div className="h-3 w-3 flex items-center justify-center">
                <div className="h-2 w-2 bg-background rounded-full" />
              </div>
            )}
          </Button>
        ))}
      </div>
    </div>
  );

  // Desktop weekday selector
  const DesktopWeekdaySelector = () => (
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
              className="text-sm font-normal cursor-pointer flex-1"
            >
              {day.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );

  // Function to open date picker
  const openDatePicker = (id: string) => {
    const input = document.getElementById(id) as HTMLInputElement;
    input?.showPicker?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <div className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-lg sm:text-xl">
                {editHabit ? 'Edit Habit' : 'Create New Habit'}
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                {editHabit ? 'Update your habit details' : 'Add a new habit to track'}
              </DialogDescription>
            </DialogHeader>

            {/* Mobile Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="md:hidden">
              <TabsList className="grid grid-cols-3 mb-6">
                <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                <TabsTrigger value="schedule" className="text-xs">Schedule</TabsTrigger>
                <TabsTrigger value="category" className="text-xs">Category</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Habit Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Morning Workout"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-base"
                  />
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={frequency} onValueChange={handleFrequencyChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="weekdays">Custom Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Weekly Day</Label>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm font-medium">
                        Repeats every <span className="text-primary">{getWeeklyDayLabel(weeklyDay)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on your start date
                      </p>
                    </div>
                  </div>
                )}

                {frequency === 'weekdays' && <MobileWeekdaySelector />}

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => openDatePicker('start-date')}
                      >
                        <Calendar className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date">End Date (Optional)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => openDatePicker('end-date')}
                      >
                        <Calendar className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="category" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="category">Category</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCategoryManager(true)}
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

                <MobileCategoryManager />
              </TabsContent>
            </Tabs>

            {/* Desktop Layout */}
            <div className="hidden md:block space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Habit Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Morning Workout"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-base"
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
                        {showCategoryManager ? "Hide" : "Manage"}
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

                  {showCategoryManager && <DesktopCategoryManager />}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select value={frequency} onValueChange={handleFrequencyChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="weekdays">Custom Days</SelectItem>
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

                  {frequency === 'weekdays' && <DesktopWeekdaySelector />}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date-desktop">Start Date</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="start-date-desktop"
                            type="date"
                            value={startDate}
                            onChange={(e) => handleStartDateChange(e.target.value)}
                            className="w-full pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-transparent"
                            onClick={() => openDatePicker('start-date-desktop')}
                          >
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="end-date-desktop">End Date (Optional)</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="end-date-desktop"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate}
                            className="w-full pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 hover:bg-transparent"
                            onClick={() => openDatePicker('end-date-desktop')}
                          >
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Submit Button */}
            <div className="md:hidden mt-8">
              <div className="flex gap-2">
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
                  disabled={habitLoading || !name.trim()}
                  className="flex-1 bg-gradient-primary h-12 text-base"
                  size="lg"
                >
                  {habitLoading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : null}
                  {editHabit ? "Update Habit" : "Create Habit"}
                </Button>
              </div>
            </div>
          </div>

          {/* Desktop Submit Button */}
          <div className="hidden md:block border-t p-6 bg-card/50">
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={habitLoading || !name.trim()}
                className="bg-gradient-primary"
              >
                {habitLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {editHabit ? "Update Habit" : "Create Habit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              disabled={categoryLoading}
            >
              {categoryLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};