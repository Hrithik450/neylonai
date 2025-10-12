import AISolutionz from "@/assets/images/ai-solutionz.png";
import { guminertRegular } from "@/assets/fonts";
import { Button } from "@/components/ui/button";
import { cn, navLists } from "@/lib/utils";
import Image from "next/image";

export function Navbar() {
  return (
    <header
      id="header"
      className={cn(
        "max-w-[120rem] mx-auto absolute z-99 w-full py-6 sm:py-8 px-5 sm:px-20 bg-transparent flex justify-between items-center",
        guminertRegular.className
      )}
    >
      <nav className="container mx-auto flex items-center w-full bg-white/25 backdrop-blur-xs border border-gray-400/60 rounded-full p-2 xl:p-3">
        <div className="px-6 max-w-[200px] xl:max-w-[240px] w-full">
          <Image src={AISolutionz} alt="ai-solutionz" />
        </div>

        <div className="flex flex-1 justify-center max-sm:hidden">
          {navLists.map((navItem) => (
            <div
              className="px-2 xl:px-4 text-black transition-all text-sm md:text-md xl:text-lg cursor-pointer"
              key={navItem.id}
            >
              {navItem.label}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 xl:gap-6 max-sm:justify-end max-sm:flex-1">
          <button className="m-0 p-0 text-md xl:text-lg cursor-pointer hover:bg-none">
            Login
          </button>

          <Button
            variant="default"
            className="rounded-full px-6 xl:px-10 py-6 text-md cursor-pointer"
          >
            Sign up
          </Button>
        </div>
      </nav>
    </header>
  );
}
