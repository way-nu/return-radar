import type {Metadata} from "next";
import {ConsoleShell} from "@/components/console-shell";

export const metadata: Metadata = {title: "Console · ReturnRadar"};

export default function ConsoleLayout({children}: LayoutProps<"/console">) {
    return <ConsoleShell>{children}</ConsoleShell>;
}
