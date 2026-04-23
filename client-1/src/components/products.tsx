// "use client";

// import gsap from "gsap";
// import { useGSAP } from "@gsap/react";
// import { ScrollTrigger } from "gsap/all";
// import { VideoCarousel } from "@/components/agency/video-carousel";
// gsap.registerPlugin(ScrollTrigger);

// export function Products() {
//   useGSAP(() => {
//     const highlightTl = gsap.timeline({
//       scrollTrigger: {
//         trigger: "#products",
//         start: "top 75%",
//       },
//     });

//     highlightTl.to("#title", { opacity: 1, y: 0 }).to(".link", {
//       y: 0,
//       opacity: 1,
//       stagger: 0.25,
//     });
//   }, []);

//   return (
//     <section
//       id="products"
//       className="font-sf-pro-regular overflow-hidden h-full bg-transparent py-20 sm:py-24 px-5 sm:px-10"
//     >
//       <div className="screen-max-width container mx-auto">
//         <div className="mb-12 w-full flex justify-center items-center">
//           <h1
//             id="title"
//             className="font-sf-pro-medium text-gray text-3xl md:text-5xl lg:text-6xl mb-5 lg:mb-0 font-medium translate-y-20 opacity-0"
//           >
//             Our Solutions
//           </h1>
//         </div>

//         <VideoCarousel />
//       </div>
//     </section>
//   );
// }
