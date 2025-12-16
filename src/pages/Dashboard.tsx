import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, LogOut, Plus, Trophy, BarChart3, Calendar, List, Target, Menu, Medal, Crown, Award, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { HabitList } from "@/components/HabitList";
import { StatsOverview } from "@/components/StatsOverview";
import { Leaderboard } from "@/components/Leaderboard";
import { CreateHabitDialog } from "@/components/CreateHabitDialog";
import { WeeklyStreakChart } from "@/components/WeeklyStreakChart";
import { WeeklyStreakTable } from "@/components/WeeklyStreakTable";
import { ProfileIcon } from "@/components/ProfileIcon";
import { RecentActivity } from "@/components/RecentActivity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingHabit, setEditingHabit] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    window.matchMedia("(orientation: portrait)").matches ? 'portrait' : 'landscape'
  );

  // Media query hooks for responsive design
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1024px)");
  const isDesktop = useMediaQuery("(min-width: 1025px)");
  const isLargeScreen = useMediaQuery("(min-width: 1280px)");

  // Handle orientation change
  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(window.matchMedia("(orientation: portrait)").matches ? 'portrait' : 'landscape');
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    const mediaQuery = window.matchMedia("(orientation: portrait)");
    mediaQuery.addEventListener('change', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      mediaQuery.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/auth");
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;
    let pollInterval: NodeJS.Timeout;

    const fetchLeaderboard = async () => {
      if (!mounted) return;

      setLeaderboardLoading(true);
      setLeaderboardError(null);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .gt('total_streak', 0)
          .order('total_streak', { ascending: false })
          .limit(10);

        if (error) {
          console.error("Leaderboard fetch error:", error);
          setLeaderboardError("Failed to load leaderboard");
          toast.error("Could not load leaderboard data");
          return;
        }

        if (mounted) {
          setLeaderboardData(data || []);
          
          if (data) {
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('total_streak')
              .eq('id', user.id)
              .single();

            if (userProfile && userProfile.total_streak > 0) {
              const userIndex = data.findIndex(p => p.id === user.id);
              if (userIndex !== -1) {
                setUserRank(userIndex + 1);
              } else {
                const { data: allProfiles } = await supabase
                  .from('profiles')
                  .select('id, total_streak')
                  .gt('total_streak', 0)
                  .order('total_streak', { ascending: false });

                if (allProfiles) {
                  const actualIndex = allProfiles.findIndex(p => p.id === user.id);
                  setUserRank(actualIndex >= 0 ? actualIndex + 1 : null);
                }
              }
            } else {
              setUserRank(null);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        setLeaderboardError("An unexpected error occurred");
      } finally {
        if (mounted) {
          setLeaderboardLoading(false);
        }
      }
    };

    fetchLeaderboard();

    pollInterval = setInterval(fetchLeaderboard, 30000);

    const channel = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          if (mounted) {
            if (payload.new.id === user.id) {
              fetchLeaderboard();
            } else {
              setLeaderboardData(prev => {
                const updatedData = [...prev];
                const index = updatedData.findIndex(u => u.id === payload.new.id);
                
                if (index !== -1) {
                  updatedData[index] = { ...updatedData[index], ...payload.new };
                }
                
                return updatedData.sort((a, b) => b.total_streak - a.total_streak);
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshTrigger]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    setShowSignOutDialog(false);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEditHabit = (habit: any) => {
    setEditingHabit(habit);
    setShowCreateDialog(true);
  };

  const handleDialogClose = () => {
    setShowCreateDialog(false);
    setTimeout(() => setEditingHabit(null), 200);
  };

  // Responsive grid columns based on screen size and orientation
  const getGridColumns = () => {
    if (isMobile) {
      return orientation === 'portrait' ? '1' : '2';
    }
    if (isTablet) {
      return orientation === 'portrait' ? '2' : '3';
    }
    return '2';
  };

  // Responsive padding based on screen size
  const getContainerPadding = () => {
    if (isMobile) {
      return orientation === 'portrait' ? 'px-3 py-4' : 'px-4 py-5';
    }
    if (isTablet) {
      return orientation === 'portrait' ? 'px-4 py-6' : 'px-5 py-7';
    }
    return 'px-4 py-8';
  };

  // Responsive header size based on screen size
  const getHeaderSize = () => {
    if (isMobile) {
      return orientation === 'portrait' ? 'text-lg' : 'text-xl';
    }
    if (isTablet) {
      return orientation === 'portrait' ? 'text-xl' : 'text-2xl';
    }
    return 'text-2xl';
  };

  // Loading Skeletons
  const LoadingSkeleton = () => (
    <div className="animate-pulse">
      {/* Header Loading */}
      <div className={cn(
        "border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50",
        isMobile && orientation === 'landscape' ? 'py-2' : 'py-3'
      )}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={cn(
                "bg-muted rounded-md",
                isMobile ? "w-8 h-8" : "w-10 h-10 sm:w-12 sm:h-12"
              )}></div>
              <div className="hidden sm:block">
                <div className={cn(
                  "h-6 bg-muted rounded mb-1",
                  isMobile ? "w-28" : "w-32"
                )}></div>
                <div className={cn(
                  "h-3 bg-muted rounded",
                  isMobile ? "w-20" : "w-24"
                )}></div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className={cn(
                "h-8 bg-muted rounded",
                isMobile ? "w-12" : "w-16"
              )}></div>
            </div>
          </div>
        </div>
      </div>

      <main className={cn(
        "container mx-auto",
        getContainerPadding()
      )}>
        {/* Quick Actions Header Loading */}
        <div className={cn(
          "flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 sm:mb-8",
          isMobile && orientation === 'landscape' && "flex-row items-center mb-4"
        )}>
          <div className="space-y-2">
            <div className={cn(
              "h-8 bg-muted rounded",
              isMobile ? "w-32" : "w-40"
            )}></div>
            <div className={cn(
              "h-4 bg-muted rounded",
              isMobile ? "w-48" : "w-64"
            )}></div>
          </div>
          <div className={cn(
            "h-10 bg-muted rounded",
            isMobile ? "w-full" : "w-32"
          )}></div>
        </div>

        {/* Tabs Loading */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-2 p-1 bg-muted/50 rounded-lg mb-6">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-10 bg-muted rounded"></div>
          ))}
        </div>

        {/* Mobile Tabs Loading */}
        <div className="sm:hidden mb-6">
          <div className="h-12 bg-muted rounded"></div>
        </div>

        {/* Overview Tab Loading */}
        <div className={cn(
          "grid gap-4 sm:gap-6",
          isMobile && orientation === 'landscape' ? 'grid-cols-2' : 'lg:grid-cols-2'
        )}>
          {/* Left Column Loading */}
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-card rounded-lg p-4 sm:p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-muted rounded"></div>
                  <div className={cn(
                    "h-5 bg-muted rounded",
                    isMobile ? "w-28" : "w-32"
                  )}></div>
                </div>
                <div className={cn(
                  "h-4 bg-muted rounded",
                  isMobile ? "w-40" : "w-48"
                )}></div>
                <div className="space-y-4 pt-4">
                  <div className={cn(
                    "grid gap-4",
                    isMobile && orientation === 'landscape' ? 'grid-cols-4' : 'grid-cols-2'
                  )}>
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item} className="bg-muted/30 rounded-lg p-4">
                        <div className={cn(
                          "h-3 bg-muted rounded mb-2",
                          isMobile ? "w-12" : "w-16"
                        )}></div>
                        <div className={cn(
                          "h-8 bg-muted rounded",
                          isMobile ? "w-8" : "w-12"
                        )}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 sm:p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-muted rounded"></div>
                  <div className={cn(
                    "h-5 bg-muted rounded",
                    isMobile ? "w-36" : "w-40"
                  )}></div>
                </div>
                <div className={cn(
                  "h-4 bg-muted rounded",
                  isMobile ? "w-28" : "w-32"
                )}></div>
                <div className={cn(
                  "h-48 bg-muted/30 rounded-lg mt-4",
                  isMobile && orientation === 'landscape' && "h-32"
                )}></div>
              </div>
            </div>
          </div>

          {/* Right Column Loading */}
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-card rounded-lg p-4 sm:p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-muted rounded"></div>
                  <div className={cn(
                    "h-5 bg-muted rounded",
                    isMobile ? "w-32" : "w-36"
                  )}></div>
                </div>
                <div className={cn(
                  "h-4 bg-muted rounded",
                  isMobile ? "w-40" : "w-48"
                )}></div>
                <div className="space-y-6 pt-4">
                  {/* Top 3 Podium Loading */}
                  <div className={cn(
                    "flex items-center justify-center gap-4 py-6",
                    isMobile && orientation === 'landscape' && "py-3 gap-2"
                  )}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex flex-col items-center">
                        <div className={cn(
                          "rounded-full bg-muted mb-3",
                          isMobile && orientation === 'landscape' 
                            ? "w-12 h-12" 
                            : "w-16 h-16 sm:w-20 sm:h-20"
                        )} />
                        <div className={cn(
                          "bg-muted rounded-xl",
                          isMobile && orientation === 'landscape'
                            ? "w-16 h-6"
                            : "w-24 h-8 sm:w-32 sm:h-10"
                        )} />
                      </div>
                    ))}
                  </div>
                  
                  {/* User Stats Loading */}
                  <div className={cn(
                    "p-4 bg-muted/30 rounded-lg border-2 border-primary/20",
                    isMobile && orientation === 'landscape' && "p-3"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "rounded-full bg-muted",
                          isMobile && orientation === 'landscape'
                            ? "w-8 h-8"
                            : "w-10 h-10 sm:w-12 sm:h-12"
                        )} />
                        <div>
                          <div className={cn(
                            "h-3 bg-muted rounded mb-2",
                            isMobile && orientation === 'landscape' ? "w-12" : "w-16"
                          )} />
                          <div className={cn(
                            "h-6 bg-muted rounded",
                            isMobile && orientation === 'landscape' ? "w-6" : "w-8"
                          )} />
                        </div>
                      </div>
                      <div>
                        <div className={cn(
                          "h-3 bg-muted rounded mb-2",
                          isMobile && orientation === 'landscape' ? "w-16" : "w-20"
                        )} />
                        <div className={cn(
                          "h-6 bg-muted rounded",
                          isMobile && orientation === 'landscape' ? "w-8" : "w-10"
                        )} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 sm:p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-muted rounded"></div>
                  <div className={cn(
                    "h-5 bg-muted rounded",
                    isMobile ? "w-28" : "w-32"
                  )}></div>
                </div>
                <div className={cn(
                  "h-4 bg-muted rounded",
                  isMobile ? "w-40" : "w-48"
                )}></div>
                <div className="text-center py-6 sm:py-8">
                  <div className={cn(
                    "bg-muted rounded-full mx-auto mb-3 sm:mb-4",
                    isMobile ? "w-8 h-8" : "w-10 h-10 sm:w-12 sm:h-12"
                  )}></div>
                  <div className={cn(
                    "h-4 bg-muted rounded mx-auto",
                    isMobile ? "w-40" : "w-48"
                  )}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingSkeleton />
      </div>
    );
  }

  // Mobile Navigation Sheet
  const MobileNavigation = () => (
    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "lg:hidden",
            orientation === 'landscape' && "w-8 h-8"
          )}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="left" 
        className={cn(
          "w-[280px] sm:w-[350px]",
          orientation === 'landscape' && "w-[320px]"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                StreakMaster
              </h1>
              <p className="text-xs text-muted-foreground">Competitive Habit Tracking</p>
            </div>
          </div>
          
          <div className="flex-1 space-y-2 sm:space-y-4">
            <Button
              variant={activeTab === "overview" ? "secondary" : "ghost"}
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                setActiveTab("overview");
                setIsMobileMenuOpen(false);
              }}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </Button>
            <Button
              variant={activeTab === "habits" ? "secondary" : "ghost"}
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                setActiveTab("habits");
                setIsMobileMenuOpen(false);
              }}
            >
              <List className="w-4 h-4 mr-2" />
              My Habits
            </Button>
            <Button
              variant={activeTab === "analytics" ? "secondary" : "ghost"}
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                setActiveTab("analytics");
                setIsMobileMenuOpen(false);
              }}
            >
              <Target className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            <Button
              variant={activeTab === "leaderboard" ? "secondary" : "ghost"}
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                setActiveTab("leaderboard");
                setIsMobileMenuOpen(false);
              }}
            >
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </Button>
          </div>
          
          <div className="pt-4 sm:pt-6 border-t">
            <Button 
              variant="destructive" 
              className="w-full text-sm sm:text-base"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setShowSignOutDialog(true);
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  // Top 3 Podium Component
  const TopThreePodium = () => {
    if (leaderboardLoading) {
      return (
        <div className="animate-pulse">
          <div className={cn(
            "flex items-center justify-center gap-4 py-6",
            isMobile && orientation === 'landscape' && "py-3 gap-2"
          )}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <div className={cn(
                  "rounded-full bg-muted mb-3",
                  isMobile && orientation === 'landscape' 
                    ? "w-12 h-12" 
                    : "w-16 h-16 sm:w-20 sm:h-20"
                )} />
                <div className={cn(
                  "bg-muted rounded-xl",
                  isMobile && orientation === 'landscape'
                    ? "w-16 h-6"
                    : "w-24 h-8 sm:w-32 sm:h-10"
                )} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (leaderboardError) {
      return (
        <div className={cn(
          "py-6 text-center",
          isMobile && orientation === 'landscape' && "py-3"
        )}>
          <p className="text-destructive mb-2 text-sm sm:text-base">{leaderboardError}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      );
    }

    const top3 = leaderboardData.slice(0, 3);
    
    if (top3.length === 0) {
      return (
        <div className={cn(
          "py-6 text-center",
          isMobile && orientation === 'landscape' && "py-3"
        )}>
          <Trophy className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground opacity-50" />
          <p className="text-sm sm:text-base text-muted-foreground">No leaderboard data available</p>
        </div>
      );
    }
    
    const getRankIcon = (rank: number) => {
      const baseClass = "flex items-center justify-center rounded-full";
      const size = isMobile && orientation === 'landscape' ? "w-8 h-8" : "w-10 h-10 sm:w-12 sm:h-12";
      
      switch (rank) {
        case 1:
          return (
            <div className={`${baseClass} ${size} bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-lg`}>
              <Crown className={cn(
                "text-white",
                isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"
              )} />
            </div>
          );
        case 2:
          return (
            <div className={`${baseClass} ${size} bg-gradient-to-br from-gray-300 to-gray-400`}>
              <Medal className={cn(
                "text-white",
                isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"
              )} />
            </div>
          );
        case 3:
          return (
            <div className={`${baseClass} ${size} bg-gradient-to-br from-orange-300 to-orange-500`}>
              <Award className={cn(
                "text-white",
                isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"
              )} />
            </div>
          );
        default:
          return null;
      }
    };

    // For mobile landscape, use horizontal layout
    if (isMobile && orientation === 'landscape') {
      return (
        <div className="space-y-3">
          <div className="flex justify-center gap-3">
            {top3.map((leader, index) => (
              <div 
                key={leader.id}
                className={cn(
                  "rounded-lg p-3 shadow-md border flex-1 min-w-0",
                  index === 0 ? 'bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/30' :
                  index === 1 ? 'bg-gradient-to-b from-gray-500/20 to-transparent border-gray-500/30' :
                  'bg-gradient-to-b from-orange-500/20 to-transparent border-orange-500/30'
                )}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-2">
                    {getRankIcon(index + 1)}
                  </div>
                  <h3 className="font-bold text-sm truncate w-full mb-1">
                    {leader.username || leader.email?.split('@')[0] || 'User'}
                  </h3>
                  {leader.id === user?.id && (
                    <Badge variant="secondary" size="sm" className="mb-1 text-xs px-1">
                      You
                    </Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <Flame className="w-3 h-3 text-warning" />
                    <span className="text-base font-bold">{leader.total_streak || 0}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs mt-1">
                    #{index + 1}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Desktop Podium - Grid Layout */}
        <div className="hidden lg:grid grid-cols-3 gap-4 py-4">
          {top3.length >= 3 ? (
            <>
              {/* Second Place */}
              <div 
                className={`rounded-xl p-4 shadow-lg border ${
                  top3[1] ? 'bg-gradient-to-b from-gray-500/20 to-transparent border-gray-500/30 order-1 mt-6' : ''
                }`}
              >
                {top3[1] && (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3">
                      {getRankIcon(2)}
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate w-full">
                      {top3[1].username || top3[1].email?.split('@')[0] || 'User'}
                    </h3>
                    {top3[1].id === user?.id && (
                      <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                        You
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 mb-2">
                      <Flame className="w-4 h-4 text-warning" />
                      <span className="text-2xl font-bold">{top3[1].total_streak || 0}</span>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      #2
                    </Badge>
                  </div>
                )}
              </div>

              {/* First Place */}
              <div 
                className={`rounded-xl p-4 shadow-lg border ${
                  top3[0] ? 'bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/30 order-2' : ''
                }`}
              >
                {top3[0] && (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3">
                      {getRankIcon(1)}
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate w-full">
                      {top3[0].username || top3[0].email?.split('@')[0] || 'User'}
                    </h3>
                    {top3[0].id === user?.id && (
                      <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                        You
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 mb-2">
                      <Flame className="w-4 h-4 text-warning" />
                      <span className="text-2xl font-bold">{top3[0].total_streak || 0}</span>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      #1
                    </Badge>
                  </div>
                )}
              </div>

              {/* Third Place */}
              <div 
                className={`rounded-xl p-4 shadow-lg border ${
                  top3[2] ? 'bg-gradient-to-b from-orange-500/20 to-transparent border-orange-500/30 order-3 mt-6' : ''
                }`}
              >
                {top3[2] && (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3">
                      {getRankIcon(3)}
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate w-full">
                      {top3[2].username || top3[2].email?.split('@')[0] || 'User'}
                    </h3>
                    {top3[2].id === user?.id && (
                      <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                        You
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 mb-2">
                      <Flame className="w-4 h-4 text-warning" />
                      <span className="text-2xl font-bold">{top3[2].total_streak || 0}</span>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      #3
                    </Badge>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="col-span-3">
              <div className="flex justify-center items-center gap-4">
                {top3.map((leader, index) => {
                  const displayName = leader.username || leader.email?.split('@')[0] || 'User';
                  
                  return (
                    <div 
                      key={leader.id}
                      className={`rounded-xl p-4 shadow-lg border ${
                        index === 0 ? 'bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/30' :
                        'bg-gradient-to-b from-gray-500/20 to-transparent border-gray-500/30'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-3">
                          {getRankIcon(index + 1)}
                        </div>
                        <h3 className="font-bold text-lg mb-1">{displayName}</h3>
                        {leader.id === user?.id && (
                          <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                            You
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 mb-2">
                          <Flame className="w-4 h-4 text-warning" />
                          <span className="text-2xl font-bold">{leader.total_streak || 0}</span>
                        </div>
                        <Badge variant="secondary" className="text-sm">
                          #{index + 1}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Podium - Stack Layout */}
        <div className="lg:hidden">
          <div className="flex flex-col items-center gap-4 py-4">
            {/* First Place */}
            {top3[0] && (
              <div 
                className={`rounded-xl p-4 shadow-lg border w-full max-w-xs ${
                  'bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/30'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3">
                    {getRankIcon(1)}
                  </div>
                  <h3 className="font-bold text-lg mb-1">
                    {top3[0].username || top3[0].email?.split('@')[0] || 'User'}
                  </h3>
                  {top3[0].id === user?.id && (
                    <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                      You
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 mb-2">
                    <Flame className="w-4 h-4 text-warning" />
                    <span className="text-2xl font-bold">{top3[0].total_streak || 0}</span>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    #1
                  </Badge>
                </div>
              </div>
            )}

            {/* 2nd and 3rd places side by side on mobile */}
            {(top3[1] || top3[2]) && (
              <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                {/* Second Place */}
                {top3[1] && (
                  <div 
                    className={`rounded-xl p-4 shadow-lg border ${
                      'bg-gradient-to-b from-gray-500/20 to-transparent border-gray-500/30'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3">
                        {getRankIcon(2)}
                      </div>
                      <h3 className="font-bold text-base mb-1 truncate w-full">
                        {top3[1].username || top3[1].email?.split('@')[0] || 'User'}
                      </h3>
                      {top3[1].id === user?.id && (
                        <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                          You
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 mb-2">
                        <Flame className="w-3 h-3 text-warning" />
                        <span className="text-xl font-bold">{top3[1].total_streak || 0}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        #2
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Third Place */}
                {top3[2] && (
                  <div 
                    className={`rounded-xl p-4 shadow-lg border ${
                      'bg-gradient-to-b from-orange-500/20 to-transparent border-orange-500/30'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3">
                        {getRankIcon(3)}
                      </div>
                      <h3 className="font-bold text-base mb-1 truncate w-full">
                        {top3[2].username || top3[2].email?.split('@')[0] || 'User'}
                      </h3>
                      {top3[2].id === user?.id && (
                        <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                          You
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 mb-2">
                        <Flame className="w-3 h-3 text-warning" />
                        <span className="text-xl font-bold">{top3[2].total_streak || 0}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        #3
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // User Stats Component
  const UserStats = () => {
    const currentUser = leaderboardData.find(u => u.id === user?.id);
    const userStreak = currentUser?.total_streak || 0;
    
    if (leaderboardLoading) {
      return (
        <div className={cn(
          "mt-4 p-4 bg-muted/30 rounded-lg border-2 border-primary/20 animate-pulse",
          isMobile && orientation === 'landscape' && "p-3 mt-3"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "rounded-full bg-muted",
                isMobile && orientation === 'landscape' ? "w-8 h-8" : "w-10 h-10 sm:w-12 sm:h-12"
              )} />
              <div>
                <div className={cn(
                  "h-3 bg-muted rounded mb-2",
                  isMobile && orientation === 'landscape' ? "w-12" : "w-16"
                )} />
                <div className={cn(
                  "h-6 bg-muted rounded",
                  isMobile && orientation === 'landscape' ? "w-6" : "w-8"
                )} />
              </div>
            </div>
            <div>
              <div className={cn(
                "h-3 bg-muted rounded mb-2",
                isMobile && orientation === 'landscape' ? "w-16" : "w-20"
              )} />
              <div className={cn(
                "h-6 bg-muted rounded",
                isMobile && orientation === 'landscape' ? "w-8" : "w-10"
              )} />
            </div>
          </div>
        </div>
      );
    }

    if (leaderboardError) {
      return (
        <div className={cn(
          "mt-4 p-4 bg-destructive/10 rounded-lg border-2 border-destructive/20",
          isMobile && orientation === 'landscape' && "p-3 mt-3"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "rounded-full bg-destructive/20 flex items-center justify-center",
                isMobile && orientation === 'landscape' ? "w-8 h-8" : "w-10 h-10 sm:w-12 sm:h-12"
              )}>
                <Trophy className={cn(
                  "text-destructive",
                  isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"
                )} />
              </div>
              <div>
                <p className={cn(
                  "text-destructive",
                  isMobile && orientation === 'landscape' ? "text-xs" : "text-xs sm:text-sm"
                )}>Error loading rank</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => setRefreshTrigger(prev => prev + 1)}
                  className="p-0 h-auto text-xs"
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className={cn(
        "mt-4 p-4 bg-muted/30 rounded-lg border-2 border-primary/20",
        isMobile && orientation === 'landscape' && "p-3 mt-3"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "rounded-full bg-gradient-primary flex items-center justify-center",
              isMobile && orientation === 'landscape' ? "w-8 h-8" : "w-10 h-10 sm:w-12 sm:h-12"
            )}>
              <Trophy className={cn(
                "text-white",
                isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-5 h-5 sm:w-6 sm:h-6"
              )} />
            </div>
            <div>
              <p className={cn(
                "text-muted-foreground",
                isMobile && orientation === 'landscape' ? "text-xs" : "text-xs sm:text-sm"
              )}>Your Rank</p>
              <p className={cn(
                "font-bold",
                isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-2xl"
              )}>
                {userRank ? `#${userRank}` : userStreak > 0 ? 'Ranking...' : 'Unranked'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn(
              "text-muted-foreground",
              isMobile && orientation === 'landscape' ? "text-xs" : "text-xs sm:text-sm"
            )}>Total Streaks</p>
            <p className={cn(
              "font-bold text-primary",
              isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-2xl"
            )}>
              {userStreak || 0}
            </p>
          </div>
        </div>
        
        {userStreak === 0 && (
          <div className="mt-3 pt-3 border-t border-primary/20">
            <p className="text-xs text-muted-foreground">
              Complete habits for 1 day to appear on the leaderboard!
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className={cn(
        "border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50",
        isMobile && orientation === 'landscape' ? 'py-2' : 'py-3 sm:py-4'
      )}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <MobileNavigation />
              <div className={cn(
                "bg-gradient-primary rounded-lg",
                isMobile ? "p-1.5" : "hidden sm:flex p-2"
              )}>
                <Flame className={cn(
                  "text-white",
                  isMobile ? "w-4 h-4" : "w-6 h-6"
                )} />
              </div>
              <div className="hidden sm:block">
                <h1 className={cn(
                  "font-bold bg-gradient-primary bg-clip-text text-transparent",
                  getHeaderSize()
                )}>
                  StreakMaster
                </h1>
                <p className="text-xs text-muted-foreground">Competitive Habit Tracking</p>
              </div>
            </div>
            
            <div className="hidden lg:flex items-center justify-center w-full gap-4">
              {/* Welcome message can be added here */}
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <ProfileIcon 
                user={user} 
                onSignOut={() => setShowSignOutDialog(true)} 
                size={isMobile && orientation === 'landscape' ? "sm" : "default"}
              />
            </div>
          </div>
        </div>
      </header>

      <main className={cn(
        "container mx-auto",
        getContainerPadding()
      )}>
        {/* Quick Actions Header */}
        <div className={cn(
          "flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 sm:mb-8",
          isMobile && orientation === 'landscape' && "flex-row items-center mb-4"
        )}>
          <div className={cn(
            "min-w-0",
            isMobile && orientation === 'landscape' && "flex-1"
          )}>
            <h2 className={cn(
              "font-bold truncate",
              isMobile && orientation === 'landscape' ? "text-xl" : "text-2xl sm:text-3xl"
            )}>Dashboard</h2>
            <p className={cn(
              "text-muted-foreground truncate",
              isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
            )}>
              Track your progress and build better habits
            </p>
          </div>
          <Button 
            onClick={() => {
              setEditingHabit(null);
              setShowCreateDialog(true);
            }}
            className="bg-gradient-primary w-full sm:w-auto"
            size={isMobile && orientation === 'landscape' ? "sm" : "default"}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>New Habit</span>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          {/* Desktop Tabs */}
          <TabsList className={cn(
            "hidden sm:grid gap-2 p-1 bg-muted/50 rounded-lg",
            orientation === 'landscape' ? 'grid-cols-4' : 'grid-cols-2 lg:grid-cols-4'
          )}>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="habits" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              <span>My Habits</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <span>Leaderboard</span>
            </TabsTrigger>
          </TabsList>

          {/* Mobile Tab Switcher */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    {activeTab === "overview" && <BarChart3 className="w-4 h-4" />}
                    {activeTab === "habits" && <List className="w-4 h-4" />}
                    {activeTab === "analytics" && <Target className="w-4 h-4" />}
                    {activeTab === "leaderboard" && <Trophy className="w-4 h-4" />}
                    <span className="capitalize text-sm">
                      {activeTab === "overview" && "Overview"}
                      {activeTab === "habits" && "My Habits"}
                      {activeTab === "analytics" && "Analytics"}
                      {activeTab === "leaderboard" && "Leaderboard"}
                    </span>
                  </div>
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[calc(100vw-2rem)]">
                <DropdownMenuItem onClick={() => setActiveTab("overview")}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Overview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("habits")}>
                  <List className="w-4 h-4 mr-2" />
                  My Habits
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("analytics")}>
                  <Target className="w-4 h-4 mr-2" />
                  Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("leaderboard")}>
                  <Trophy className="w-4 h-4 mr-2" />
                  Leaderboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className={cn(
              "grid gap-4 sm:gap-6",
              isMobile && orientation === 'landscape' ? 'grid-cols-2' : 'lg:grid-cols-2'
            )}>
              {/* Left Column */}
              <div className="space-y-4 sm:space-y-6">
                <Card className={cn(
                  isMobile && orientation === 'landscape' && "h-full"
                )}>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className={cn(
                      "flex items-center gap-2",
                      isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-xl"
                    )}>
                      <BarChart3 className={cn(
                        isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-4 h-4 sm:w-5 sm:h-5"
                      )} />
                      Quick Stats
                    </CardTitle>
                    <CardDescription className={cn(
                      isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                    )}>
                      Your habit tracking overview
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StatsOverview 
                      userId={user?.id} 
                      refreshTrigger={refreshTrigger} 
                      compact={isMobile && orientation === 'landscape'}
                    />
                  </CardContent>
                </Card>

                <Card className={cn(
                  isMobile && orientation === 'landscape' && "h-full"
                )}>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className={cn(
                      "flex items-center gap-2",
                      isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-xl"
                    )}>
                      <Calendar className={cn(
                        isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-4 h-4 sm:w-5 sm:h-5"
                      )} />
                      Weekly Progress
                    </CardTitle>
                    <CardDescription className={cn(
                      isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                    )}>
                      Your streak performance this week
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <WeeklyStreakChart 
                      userId={user?.id} 
                      refreshTrigger={refreshTrigger}
                      compact={isMobile && orientation === 'landscape'}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-4 sm:space-y-6">
                <Card className={cn(
                  isMobile && orientation === 'landscape' && "h-full"
                )}>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className={cn(
                      "flex items-center gap-2",
                      isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-xl"
                    )}>
                      <Trophy className={cn(
                        isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-4 h-4 sm:w-5 sm:h-5"
                      )} />
                      Top Performers
                    </CardTitle>
                    <CardDescription className={cn(
                      isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                    )}>
                      Champion podium and your ranking
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={cn(
                    isMobile && orientation === 'landscape' && "p-3"
                  )}>
                    <TopThreePodium />
                    <UserStats />
                  </CardContent>
                </Card>

                <Card className={cn(
                  isMobile && orientation === 'landscape' && "h-full"
                )}>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className={cn(
                      "flex items-center gap-2",
                      isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-xl"
                    )}>
                      <Target className={cn(
                        isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-4 h-4 sm:w-5 sm:h-5"
                      )} />
                      Recent Activity
                    </CardTitle>
                    <CardDescription className={cn(
                      isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                    )}>
                      Your latest habit completions and achievements
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecentActivity 
                      userId={user?.id} 
                      refreshTrigger={refreshTrigger}
                      compact={isMobile && orientation === 'landscape'}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Habits Tab */}
          <TabsContent value="habits" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className={cn(
                  "flex items-center gap-2",
                  isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-xl"
                )}>
                  <List className={cn(
                    isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-4 h-4 sm:w-5 sm:h-5"
                  )} />
                  Your Habits
                </CardTitle>
                <CardDescription className={cn(
                  isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                )}>
                  Manage and track all your habits in one place
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HabitList 
                  userId={user?.id} 
                  onUpdate={triggerRefresh} 
                  refreshTrigger={refreshTrigger}
                  onEditHabit={handleEditHabit}
                  compact={isMobile && orientation === 'landscape'}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
            <div className="grid gap-4 sm:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className={cn(
                    "flex items-center gap-2",
                    isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-xl"
                  )}>
                    <BarChart3 className={cn(
                      isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-4 h-4 sm:w-5 sm:h-5"
                    )} />
                    Detailed Analytics
                  </CardTitle>
                  <CardDescription className={cn(
                    isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                  )}>
                    Comprehensive view of your habit performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WeeklyStreakChart 
                    userId={user?.id} 
                    refreshTrigger={refreshTrigger}
                    detailed={true}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className={cn(
                    "flex items-center gap-2",
                    isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-xl"
                  )}>
                    <Calendar className={cn(
                      isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-4 h-4 sm:w-5 sm:h-5"
                    )} />
                    Weekly Streak Details
                  </CardTitle>
                  <CardDescription className={cn(
                    isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                  )}>
                    Day-by-day breakdown of your progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WeeklyStreakTable 
                    userId={user?.id} 
                    refreshTrigger={refreshTrigger}
                    compact={isMobile && orientation === 'landscape'}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className={cn(
                  "flex items-center gap-2",
                  isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-xl"
                )}>
                  <Trophy className={cn(
                    isMobile && orientation === 'landscape' ? "w-4 h-4" : "w-4 h-4 sm:w-5 sm:h-5"
                  )} />
                  Global Leaderboard
                </CardTitle>
                <CardDescription className={cn(
                  isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                )}>
                  Compete with others and stay motivated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Leaderboard 
                  currentUserId={user?.id} 
                  refreshTrigger={refreshTrigger}
                  compact={isMobile && orientation === 'landscape'}
                />
              </CardContent>
            </Card>

            <div className={cn(
              "grid gap-4 sm:gap-6",
              isMobile && orientation === 'landscape' ? 'grid-cols-2' : 'lg:grid-cols-2'
            )}>
              <Card>
                <CardHeader>
                  <CardTitle className={cn(
                    isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-xl"
                  )}>Your Ranking</CardTitle>
                  <CardDescription className={cn(
                    isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                  )}>
                    See how you compare to others
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "text-center",
                    isMobile && orientation === 'landscape' ? "py-4" : "py-6 sm:py-8"
                  )}>
                    <Trophy className={cn(
                      "mx-auto mb-3 sm:mb-4 text-warning",
                      isMobile && orientation === 'landscape' ? "w-8 h-8" : "w-10 h-10 sm:w-12 sm:h-12"
                    )} />
                    <p className={cn(
                      "font-bold text-warning",
                      isMobile && orientation === 'landscape' ? "text-xl" : "text-2xl"
                    )}>
                      {userRank ? `#${userRank}` : 'Unranked'}
                    </p>
                    <p className={cn(
                      "text-muted-foreground",
                      isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                    )}>
                      {userRank && userRank <= 3 ? "You're in the top 3! 🎉" : 
                       userRank && userRank <= 10 ? "You're in the top 10! 🎉" : "Keep going!"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className={cn(
                    isMobile && orientation === 'landscape' ? "text-base" : "text-lg sm:text-xl"
                  )}>Achievements</CardTitle>
                  <CardDescription className={cn(
                    isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                  )}>
                    Unlock achievements as you progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={cn(
                    "text-center",
                    isMobile && orientation === 'landscape' ? "py-4" : "py-6 sm:py-8"
                  )}>
                    <Target className={cn(
                      "mx-auto mb-3 sm:mb-4 text-muted-foreground opacity-50",
                      isMobile && orientation === 'landscape' ? "w-8 h-8" : "w-10 h-10 sm:w-12 sm:h-12"
                    )} />
                    <p className={cn(
                      "text-muted-foreground",
                      isMobile && orientation === 'landscape' ? "text-xs" : "text-sm sm:text-base"
                    )}>
                      Achievements coming soon!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Sign Out Confirmation Dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? You'll need to sign in again to access your habits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="mt-2 sm:mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateHabitDialog 
        open={showCreateDialog} 
        onOpenChange={handleDialogClose}
        userId={user?.id}
        onHabitCreated={triggerRefresh}
        editHabit={editingHabit}
      />
    </div>
  );
};

export default Dashboard;