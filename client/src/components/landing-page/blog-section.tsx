import Image from "next/image";
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowRightIcon, Calendar } from "lucide-react";
import { guminertBold, guminertMedium, guminertRegular } from "@/assets/fonts";
import Blog1 from "@/assets/images/blog-1.jpg";
import Blog2 from "@/assets/images/blog-2.jpg";
import Blog3 from "@/assets/images/blog-3.jpg";

const blogs = [
  {
    id: 1,
    image: Blog1,
    location: "Vancouver",
    date: "March 15, 2026",
    title:
      "Eco-Friendly Investments: Exploring Sustainable Financial Opportunities",
  },
  {
    id: 2,
    image: Blog2,
    location: "Toronto",
    date: "July 4, 2027",
    title: "Green Finance: The Rise of Sustainable Investment Decisions",
  },
  {
    id: 3,
    image: Blog3,
    location: "Montreal",
    date: "November 30, 2028",
    title: "Investing in Tomorrow: How Sustainable Practices Shape Finance",
  },
];

export function LatestBlogs() {
  return (
    <section
      className={cn(
        guminertBold.className,
        "my-4 md:my-16 px-3 md:px-5 xl:px-10 2xl:px-15 relative overflow-hidden"
      )}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <h2
          className={cn(
            "text-3xl md:text-5xl max-w-sm lg:max-w-xl max-sm:mb-4",
            guminertMedium.className
          )}
        >
          Our Latest News & Blogs
        </h2>

        <button
          className={cn(
            "group flex items-center gap-3 bg-[#0d3129] p-3 px-6 rounded-full text-white cursor-pointer text-sm md:text-lg",
            guminertRegular.className
          )}
        >
          See More Blogs
          <ArrowRightIcon className="w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
        {blogs.map((blog) => (
          <div key={blog.id} className="rounded-xl overflow-hidden">
            <div className="relative rounded-xl overflow-hidden w-full h-52 md:h-64 group">
              <Image
                src={blog.image}
                alt={blog.title}
                fill
                className="w-full h-full object-cover shadow-md group-hover:scale-110 transition-all duration-500 ease-in-out"
              />
            </div>

            <div className="py-4 px-2">
              <div className="flex items-center gap-3 text-gray-500 text-sm mb-2">
                <span>{blog.location}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> {blog.date}
                </span>
              </div>

              <h3 className="text-lg md:text-xl font-semibold mb-4 line-clamp-2">
                {blog.title}
              </h3>

              <button className="cursor-pointer flex items-center gap-2 border border-gray-400 px-4 py-2 rounded-full hover:bg-gray-100 transition group">
                Read More{" "}
                <ArrowRight className="w-4 h-4 group-hover:-rotate-45 transition-all duration-300 ease-in-out" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
