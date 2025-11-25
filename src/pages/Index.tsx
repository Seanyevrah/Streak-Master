import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Flame, Trophy, Target } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // Check if there's an access token in the URL hash (from email confirmation)
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          navigate("/dashboard");
          return;
        }

        // If already authenticated, go directly to dashboard
        if (session) {
          navigate("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
       <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Flame className="w-12 h-12 mx-auto mb-4 text-gray-500 animate-pulse" /> 
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If loading finished and user not authenticated, show landing
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-primary rounded-3xl shadow-glow animate-pulse">
              <Flame className="w-16 h-16 text-white" />
            </div>
          </div>
          <h1 className="text-6xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            StreakMaster
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Build powerful habits, track your progress, and compete with friends.
            Turn consistency into your superpower.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-gradient-primary text-lg px-8"
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
              className="text-lg px-8"
            >
              Sign In
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6 bg-gradient-card rounded-xl border border-border shadow-card">
            <div className="p-3 bg-accent/10 rounded-lg w-fit mx-auto mb-4">
              <Target className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-bold mb-2">Track Habits</h3>
            <p className="text-muted-foreground">
              Create and track habits with customizable frequencies and categories.
            </p>
          </div>

          <div className="text-center p-6 bg-gradient-card rounded-xl border border-border shadow-card">
            <div className="p-3 bg-warning/10 rounded-lg w-fit mx-auto mb-4">
              <Flame className="w-8 h-8 text-warning" />
            </div>
            <h3 className="text-xl font-bold mb-2">Build Streaks</h3>
            <p className="text-muted-foreground">
              Maintain consistency and watch your streak count grow every day.
            </p>
          </div>

          <div className="text-center p-6 bg-gradient-card rounded-xl border border-border shadow-card">
            <div className="p-3 bg-secondary/10 rounded-lg w-fit mx-auto mb-4">
              <Trophy className="w-8 h-8 text-secondary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Compete</h3>
            <p className="text-muted-foreground">
              Climb the leaderboard and see how you rank against other users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;