import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import StatusBar from "./StatusBar";

const AppLayout = () => {
  return (
    <div className="flex h-screen w-screen min-w-[1280px] overflow-hidden">
      {/* Zone 1: Sidebar */}
      <Sidebar />

      {/* Zone 2 + 3: Main + Status Bar */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Zone 2: Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>

        {/* Zone 3: Status Bar */}
        <StatusBar />
      </div>
    </div>
  );
};

export default AppLayout;
