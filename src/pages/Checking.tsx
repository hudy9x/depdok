import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Checking() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check localStorage for saved tabs
    const savedTabs = localStorage.getItem("depdok-tabs");

    if (savedTabs) {
      try {
        const tabs = JSON.parse(savedTabs);

        // If we have tabs, go to editor
        if (Array.isArray(tabs) && tabs.length > 0) {
          navigate("/editor", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Error parsing saved tabs:", error);
      }
    }

    // No tabs or error parsing - go to home
    navigate("/home", { replace: true });
  }, [navigate]);

  // Optional: Show a minimal loading state
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-secondary">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
