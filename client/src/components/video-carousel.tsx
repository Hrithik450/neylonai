// "use client";

// import React from "react";
// import { hightlightsSlides } from "@/lib/iphone/utils";
// import { loadVideoElement } from "@/lib/utils";
// import { useGSAP } from "@gsap/react";
// import gsap from "gsap";
// import { useIsMobile } from "@/hooks/use-mobile";

// type Video = {
//   isEnd: boolean;
//   startPlay: boolean;
//   videoId: number;
//   isLastVideo: boolean;
//   isPlaying: boolean;
// };

// export function VideoCarousel() {
//   const isMobile = useIsMobile();

//   const videoRef = React.useRef<(HTMLVideoElement | null)[]>([]);
//   const videoSpanRef = React.useRef<(HTMLSpanElement | null)[]>([]);
//   const videoDivRef = React.useRef<(HTMLDivElement | null)[]>([]);

//   const [video, setVideo] = React.useState<Video>({
//     isEnd: false,
//     startPlay: false,
//     videoId: 0,
//     isLastVideo: false,
//     isPlaying: false,
//   });
//   const [loadedData, setLoadedData] = React.useState<(Event | null)[]>([]);

//   const { isEnd, isLastVideo, startPlay, videoId, isPlaying } = video;

//   // Handles updates to video state
//   const updateVideoState = (updates: Partial<Video>) =>
//     setVideo((prev) => ({ ...prev, ...updates }));

//   // Preload all videos
//   React.useEffect(() => {
//     const preloadVideos = async () => {
//       await Promise.all(
//         videoRef.current.map(async () => {
//           const { event } = await loadVideoElement(
//             hightlightsSlides[videoId].video
//           );
//           setLoadedData((prev) => [...prev, event]);
//         })
//       );
//     };
//     preloadVideos();
//   }, []);

//   // Play/Pause video logic
//   React.useEffect(() => {
//     if (loadedData.length >= hightlightsSlides.length) {
//       if (isPlaying && startPlay) {
//         videoRef.current[videoId]?.play();
//       } else {
//         videoRef.current[videoId]?.pause();
//       }
//     }
//   }, [startPlay, videoId, isPlaying, loadedData]);

//   // Progress bar animation
//   React.useEffect(() => {
//     let currentProgress = 0;
//     const progressBar = videoSpanRef.current;

//     if (progressBar[videoId]) {
//       // Updating progress bar's
//       const animation = gsap.to(progressBar[videoId], {
//         onUpdate: () => {
//           const progress = Math.ceil(animation.progress() * 100);
//           if (progress !== currentProgress) {
//             currentProgress = progress;

//             gsap.to(videoDivRef.current[videoId], {
//               width: isMobile ? "10vw" : "4vw",
//             });

//             gsap.to(progressBar[videoId], {
//               width: `${currentProgress}%`,
//               backgroundColor: "white",
//             });
//           }
//         },
//         onComplete: () => {
//           if (isPlaying) {
//             gsap.to(videoDivRef.current[videoId], {
//               width: "12px",
//             });

//             gsap.to(progressBar[videoId], {
//               backgroundColor: "#6B728099",
//             });
//           }
//         },
//       });

//       //   Restarting Video
//       if (videoId === 0) {
//         animation.restart();
//       }

//       //   Syncing progress with video duration
//       const animUpdate = () => {
//         animation.progress(
//           (videoRef.current[videoId]?.currentTime ?? 0) /
//             hightlightsSlides[videoId].videoDuration
//         );
//       };
//       if (isPlaying) {
//         gsap.ticker.add(animUpdate);
//       } else {
//         gsap.ticker.remove(animUpdate);
//       }
//     }
//   }, [videoId, startPlay]);

//   // handle control steps
//   const handleProcess = (type: string, i: number) => {
//     switch (type) {
//       case "video-end":
//         updateVideoState({ isEnd: true, videoId: i + 1 });
//         break;

//       case "video-last":
//         updateVideoState({ isLastVideo: true });
//         break;

//       case "video-reset":
//         updateVideoState({ isLastVideo: false, videoId: 0 });
//         break;

//       case "pause":
//         setVideo((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
//         break;

//       case "play":
//         setVideo((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
//         break;

//       default:
//         return video;
//     }
//   };

//   // Slider & more animations
//   useGSAP(() => {
//     gsap.to("#slider", {
//       transform: `translateX(${-100 * videoId}%)`,
//       duration: 1.2,
//       ease: "power2.inOut",
//     });

//     gsap.to("#video", {
//       scrollTrigger: {
//         trigger: "#video",
//         toggleActions: "restart none none none",
//       },
//       onComplete: () => updateVideoState({ startPlay: true, isPlaying: true }),
//     });
//   }, [isEnd, videoId]);

//   return (
//     <>
//       <div className="flex items-center">
//         {hightlightsSlides.map((list, i) => (
//           <div key={list.id} id="slider" className="pr-10 md:pr-12">
//             <div className="relative w-[88vw] sm:w-[78vw] h-[35vh] sm:h-[50vh] md:h-[72vh]">
//               <div className="w-full h-full flex-center rounded-3xl overflow-hidden bg-black">
//                 <video
//                   id="video"
//                   playsInline={true}
//                   className="pointer-events-none"
//                   preload="auto"
//                   muted
//                   ref={(el) => {
//                     if (el) videoRef.current[i] = el;
//                   }}
//                   onEnded={() =>
//                     i !== hightlightsSlides.length - 1
//                       ? handleProcess("video-end", i)
//                       : handleProcess("video-last", i)
//                   }
//                 >
//                   <source src={list.video} type="video/mp4" />
//                 </video>
//               </div>

//               <div className="absolute top-12 left-[5%] z-10">
//                 {list.textLists.map((text, i) => (
//                   <p key={i} className="text-xl md:text-2xl font-medium">
//                     {text}
//                   </p>
//                 ))}
//               </div>
//             </div>
//           </div>
//         ))}
//       </div>

//       <div className="relative flex-center mt-10">
//         <div className="flex-center py-5 px-7 bg-gray-500/10 backdrop-blur rounded-full">
//           {videoRef.current &&
//             videoRef.current.map((video, index) => (
//               <div
//                 key={index}
//                 className="slider relative mx-2 h-3 w-3 rounded-full cursor-pointer bg-gray-500/60"
//                 ref={(el) => {
//                   if (el) videoDivRef.current[index] = el;
//                 }}
//                 onClick={(e) => {
//                   if (video && videoId === index) {
//                     const div = e.currentTarget;
//                     const rect = div.getBoundingClientRect();
//                     const clickX = e.clientX - rect.left;
//                     const clampedX = Math.max(0, Math.min(clickX, rect.width));
//                     const newProgress = clampedX / rect.width;

//                     const video = videoRef.current[videoId];
//                     if (video) {
//                       const newTime = newProgress * video.duration;
//                       video.currentTime = newTime;
//                     }
//                   }
//                 }}
//               >
//                 <span
//                   className="absolute w-full h-full rounded-full"
//                   ref={(el) => {
//                     if (el) videoSpanRef.current[index] = el;
//                   }}
//                 />
//               </div>
//             ))}
//         </div>

//         <button className="ml-4 p-4 rounded-full bg-gray-500/10 backdrop-blur flex-center cursor-pointer">
//           <img
//             src={
//               isLastVideo
//                 ? "/images/iphone/replay.svg"
//                 : !isPlaying
//                 ? "/images/iphone/play.svg"
//                 : "/images/iphone/pause.svg"
//             }
//             alt={isLastVideo ? "replay" : !isPlaying ? "play" : "pause"}
//             onClick={
//               isLastVideo
//                 ? () => handleProcess("video-reset", 0)
//                 : !isPlaying
//                 ? () => handleProcess("play", 0)
//                 : () => handleProcess("pause", 0)
//             }
//           />
//         </button>
//       </div>
//     </>
//   );
// }
