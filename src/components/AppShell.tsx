import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-0 text-tx-0">
      <Topbar />
      <div className="grid grid-cols-1 pt-[56px] lg:grid-cols-[256px_1fr]">
        <Sidebar />
        <main className="min-h-[calc(100vh-56px)] overflow-y-auto bg-bg-0">
          {children}
          <Footer />
        </main>
      </div>
    </div>
  );
}
