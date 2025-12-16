import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, Trophy, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ProfileIconProps {
  user: User | null;
  onSignOut: () => void;
}

export const ProfileIcon = ({ user, onSignOut }: ProfileIconProps) => {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // Fetch user profile data from profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          setProfileData(profile);
        }

        // Also fetch current rank
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, total_streak')
          .gt('total_streak', 0)
          .order('total_streak', { ascending: false });

        if (allProfiles && profile?.total_streak > 0) {
          const userIndex = allProfiles.findIndex(p => p.id === user.id);
          if (userIndex !== -1) {
            // Store rank in profile data
            setProfileData((prev: any) => ({
              ...prev,
              rank: userIndex + 1
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();

    // Set up real-time subscription for profile updates
    const channel = supabase
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user?.id}`
        },
        (payload) => {
          setProfileData(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const getInitials = (email: string) => {
    if (!email) return "U";
    const parts = email.split('@')[0].split(/[.\-_]/);
    return parts.map(part => part.charAt(0).toUpperCase()).join('').slice(0, 2);
  };

  const handleViewProfile = () => {
    // You can implement a profile page or modal
    toast.info("Profile page coming soon!");
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage 
              src={profileData?.avatar_url || ""} 
              alt={profileData?.username || user.email || "User"}
            />
            <AvatarFallback className="bg-gradient-primary text-white">
              {getInitials(user.email || "User")}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {profileData?.username || user.email?.split('@')[0] || "User"}
            </p>
            {profileData?.total_streak !== undefined && (
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="secondary" className="text-xs">
                  <Trophy className="w-3 h-3 mr-1" />
                  {profileData.total_streak} streak
                </Badge>
                {profileData.rank && (
                  <Badge variant="outline" className="text-xs">
                    Rank #{profileData.rank}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleViewProfile}>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem disabled>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={onSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};