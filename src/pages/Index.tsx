import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Flame, Trophy, Target, Sparkles } from "lucide-react";

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
          <Flame className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8 sm:py-12 md:py-16">
        <div className="text-center mb-12 sm:mb-16">
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="p-3 sm:p-4 bg-gradient-primary rounded-2xl sm:rounded-3xl shadow-glow animate-pulse">
              <Flame className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-3 sm:mb-4 bg-gradient-primary bg-clip-text text-transparent">
            StreakMaster
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-xl sm:max-w-2xl mx-auto px-4">
            Build powerful habits, track your progress, and compete with friends.
            Turn consistency into your superpower.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
            <Button
              size="lg"
              onClick={() => navigate("/auth?tab=signup")} // Updated: Navigate to signup tab
              className="bg-gradient-primary text-base sm:text-lg px-6 sm:px-8 py-6 sm:py-7 h-auto"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")} // Keep default navigation for sign in
              className="text-base sm:text-lg px-6 sm:px-8 py-6 sm:py-7 h-auto"
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Stats Bar (Optional - can add later) */}
        {/* <div className="hidden sm:flex justify-center mb-12">
          <div className="grid grid-cols-3 gap-8 max-w-2xl">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">1K+</p>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">50K+</p>
              <p className="text-sm text-muted-foreground">Habits Tracked</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">95%</p>
              <p className="text-sm text-muted-foreground">Success Rate</p>
            </div>
          </div>
        </div> */}

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-6xl mx-auto">
          <div className="text-center p-4 sm:p-6 bg-gradient-card rounded-xl border border-border shadow-card hover:shadow-lg transition-shadow duration-300">
            <div className="p-3 bg-accent/10 rounded-lg w-fit mx-auto mb-3 sm:mb-4">
              <Target className="w-6 h-6 sm:w-8 sm:h-8 text-accent" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2">Track Habits</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Create and track habits with customizable frequencies and categories.
            </p>
          </div>

          <div className="text-center p-4 sm:p-6 bg-gradient-card rounded-xl border border-border shadow-card hover:shadow-lg transition-shadow duration-300">
            <div className="p-3 bg-warning/10 rounded-lg w-fit mx-auto mb-3 sm:mb-4">
              <Flame className="w-6 h-6 sm:w-8 sm:h-8 text-warning" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2">Build Streaks</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Maintain consistency and watch your streak count grow every day.
            </p>
          </div>

          <div className="text-center p-4 sm:p-6 bg-gradient-card rounded-xl border border-border shadow-card hover:shadow-lg transition-shadow duration-300">
            <div className="p-3 bg-secondary/10 rounded-lg w-fit mx-auto mb-3 sm:mb-4">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-secondary" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2">Compete</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Climb the leaderboard and see how you rank against other users.
            </p>
          </div>
        </div>

        {/* Testimonial/CTA Section */}
        <div className="mt-12 sm:mt-16 text-center max-w-2xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Join 1,000+ users building better habits</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Start Your Journey Today
          </h2>
          <p className="text-muted-foreground mb-6">
            It takes 21 days to form a habit. Start your streak today and transform your life.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth?tab=signup")} // Updated: Navigate to signup tab
            className="bg-gradient-primary text-base sm:text-lg px-8"
          >
            Start Free Trial
          </Button>
          <p className="text-xs sm:text-sm text-muted-foreground mt-4">
            No credit card required • 14-day free trial
          </p>
        </div>

        {/* Footer/Additional Info */}
        <div className="mt-16 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} StreakMaster. All rights reserved.
          </p>
          {/* <div className="flex justify-center gap-4 mt-4">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Privacy Policy
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Terms of Service
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Contact
            </Button>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Index;