import type {Metadata} from "next";
import {Inter, Noto_Sans_Devanagari, Noto_Sans_Kannada, Noto_Sans_Telugu} from "next/font/google";
import {Toaster} from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({variable: "--font-inter", subsets: ["latin"]});
const kannada = Noto_Sans_Kannada({variable: "--font-noto-kn", subsets: ["kannada"], weight: ["400", "500", "600"]});
const devanagari = Noto_Sans_Devanagari({variable: "--font-noto-dev", subsets: ["devanagari"], weight: ["400", "500"]});
const telugu = Noto_Sans_Telugu({variable: "--font-noto-te", subsets: ["telugu"], weight: ["400", "500"]});

export const metadata: Metadata = {
    title: "ReturnRadar",
    description: "Check return and “not delivered” claims before you refund.",
};

export default function RootLayout({children}: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${inter.variable} ${kannada.variable} ${devanagari.variable} ${telugu.variable} h-full antialiased`}
        >
        <body className="min-h-full flex flex-col bg-canvas text-ink">
        {children}
        <Toaster/>
        </body>
        </html>
    );
}
