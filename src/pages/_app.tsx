import { cn } from "@/lib/utils";
import SuiWalletProvider from "@/context/WalletContext";
import { type AppType } from "next/dist/shared/lib/utils";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster"
import { ToastContainer } from "react-toastify";
import { AppContextProvider } from "@/context/AppContext";
import "@/styles/globals.css";
import "react-toastify/dist/ReactToastify.css";
import MetaTagsContainer from "@/components/containers/metaTagsContainer";

const inter = Inter({ subsets: ["latin"] });

const queryClient = new QueryClient();

const MyApp: AppType = ({ Component, pageProps }) => {
  const [isClient, setIsClient] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <>
      {isClient ? (
        <QueryClientProvider client={queryClient}>
          <SuiWalletProvider>
            <AppContextProvider>
              <TooltipProvider>
                <MetaTagsContainer />
                <Component {...pageProps} className={cn(inter.className)} />
                <ToastContainer
                  theme="dark"
                  draggable
                  position="bottom-right"
                  className={"mt-20"}
                  toastClassName={(context) =>
                    "relative flex py-3.5 px-4 mx-4 min-h-10 mb-5 rounded-md justify-between overflow-hidden cursor-pointer bg-white/20 backdrop-blur-md"
                  }
                  toastStyle={{
                    WebkitBackdropFilter: "blur(12px)",
                  }}
                />
                 <Toaster />
              </TooltipProvider>
            </AppContextProvider>
          </SuiWalletProvider>
        </QueryClientProvider>
      ) : (
        <div>
          <MetaTagsContainer />
        </div>
      )}
    </>
  );
};

export default MyApp;
