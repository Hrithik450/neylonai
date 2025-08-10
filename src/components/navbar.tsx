import { Button } from "@/components/ui/button";
import { navLists } from "@/lib/utils";

export function Navbar() {
  return (
    <header
      id="header"
      className="font-sf-pro-regular max-w-[120rem] mx-auto absolute z-99 w-full py-6 sm:py-8 px-5 sm:px-20 bg-transparent flex justify-between items-center"
    >
      <nav className="container mx-auto flex items-center w-full bg-white/25 backdrop-blur-xs border border-gray-400/60 rounded-full p-4">
        <div className="px-6 max-w-[250px] w-full">
          <img
            className="w-full"
            src="/images/ai-solutionz.png"
            alt="ai-solutionz"
          />
        </div>

        <div className="flex flex-1 justify-center max-sm:hidden">
          {navLists.map((navItem) => (
            <div
              className="px-3 lg:px-4 text-black transition-all text-sm md:text-base lg:text-lg cursor-pointer"
              key={navItem.id}
            >
              {navItem.label}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6 max-sm:justify-end max-sm:flex-1">
          <button className="m-0 p-0 text-lg cursor-pointer hover:bg-none">
            Login
          </button>

          <Button
            variant="default"
            className="rounded-full m-0 px-10 py-6 text-md cursor-pointer"
          >
            Sign up
          </Button>
        </div>
      </nav>
    </header>
  );
}
