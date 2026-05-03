import React, { useEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client'
import * as $ from 'jquery'
import videojs from 'video.js'
import 'video.js/dist/video-js.css';
// import * as ll from '../../../public/images'
import _ from 'lodash';
// import OfficialLogo from "../../public/images/uwm-logo-official.png";
import MatOne from "../../public/images/test/mat1.jpg";
import MatTwo from "../../public/images/test/mat2.webp";
import MatThree from "../../public/images/test/mat3.jpg";
import MatFour from "../../public/images/test/mat4.webp";

export const publicImages = {
    "matone": MatOne,
    "mattwo": MatTwo,
    "matthree": MatThree,
    "matfour": MatFour,
};

export const currentPage = location.href.split("/")[3] == ""? "landing" : location.href.split("/")[3];


//credit => https://dev.to/musselmanth/re-rendering-react-components-at-breakpoint-window-resizes-a-better-way-4343.
const useWindowResizeThreshold = threshold => {
  const [isMobileSize, setIsMobileSize] = useState(window.innerWidth <= threshold)
  const prevWidth = useRef(window.innerWidth)

  useEffect(() => {
    const handleResize = () => {
      const currWidth = window.innerWidth
      if (currWidth <= threshold && prevWidth.current > threshold){
        setIsMobileSize(true)
      } else if (currWidth > threshold && prevWidth.current <= threshold) {
        setIsMobileSize(false)
      }
      prevWidth.current = currWidth
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return isMobileSize
}

export default useWindowResizeThreshold;

// console.log(currentPage);

const csrf = document.querySelector('meta[name="csrf-token"]').content;

// function importAll(e) { //thanks to felix kling on stack overflow.
//     return e.keys().map(e);
// }

var today = new Date();

export const sparkNotification = (api, type, title, desc) => {
  api[type]({
      message: title,
      description: desc
  });
}

export const dd = String(today.getDate()).padStart(2, '0');

export const mm = String(today.getMonth() + 1).padStart(2, '0');

export const yyyy = today.getFullYear();

export const FullCurrentDate = `${mm}/${dd}/${yyyy}`

const FOFImages = import.meta.glob(`../../public/images/404/*`); //import all files from a directory - only used in vite.
const FOTImages = import.meta.glob(`../../public/images/403/*`);
const FOTHImages = import.meta.glob(`../../public/images/500/*`);
export const AllImages = import.meta.glob(`../../public/images/*`);

export const FindImage = (imageName) => {
    var AllImagesVar = Object.values(AllImages);
    for (let i = 0; i < AllImagesVar.length; i++) {
        const element = AllImagesVar[i];
        if (element.name.search(imageName) !== -1) {
            const finalName = element.name.split(`/public`)[1]
            return finalName
        }
        return false;
    }
}

// console.log(new URL(_.shuffle(FOFImages)[0].name, import.meta.url).pathname);

export const Quotes = [`GRAFIC FOR LIFE; .`, `ALLFY OR NO LIFE.`, `GRAFIC BEST ORG.`, `GRAFIC = ALLFY > XANDER`];

export const QuoteOfTheDay = _.shuffle(Quotes)[0];

export const ErrorMessages = 
    {
        404: [
            `There appears to be an error with fetching this page; Maybe you type it in wrong??`, 
            `What? This page doesn't appear to exists!`
        ],
        403: [
            `You cannot access this data!`, 
            `Bruh`
        ],
        500: [
            `There was a server-side error! Ooops!`, 
            `Error 500 error 500 error 500 errror 55000`
        ]
    }

export const GetErrImage = (type) => {

    switch (type) {
        case 404:
            return new URL(_.shuffle(FOFImages)[0].name, import.meta.url).pathname.split(`/public`)[1]
        case 403:
            return new URL(_.shuffle(FOTImages)[0].name, import.meta.url).pathname.split(`/public`)[1]
        case 500:
            return new URL(_.shuffle(FOTHImages)[0].name, import.meta.url).pathname.split(`/public`)[1]
        default:
            return `Unable to fetch error type.`
    }

}

export const GetErrorMsg = (type) => {

    return _.shuffle(ErrorMessages[type])[0]

}

export const VideoJS = (props) => {
    const videoRef = React.useRef(null);
    const playerRef = React.useRef(null);
    const {options, onReady} = props;
  
    React.useEffect(() => {
  
      // Make sure Video.js player is only initialized once
      if (!playerRef.current) {
        // The Video.js player needs to be _inside_ the component el for React 18 Strict Mode. 
        const videoElement = document.createElement("video-js");
  
        videoElement.classList.add('vjs-big-play-centered');
        videoRef.current.appendChild(videoElement);
  
        const player = playerRef.current = videojs(videoElement, options, () => {
          videojs.log('player is ready');
          onReady && onReady(player);
        });
  
      // You could update an existing player in the `else` block here
      // on prop change, for example:
      } else {
        const player = playerRef.current;
  
        player.autoplay(options.autoplay);
        player.src(options.sources);
      }
    }, [options, videoRef]);
  
    // Dispose the Video.js player when the functional component unmounts
    React.useEffect(() => {
      const player = playerRef.current;
  
      return () => {
        if (player && !player.isDisposed()) {
          player.dispose();
          playerRef.current = null;
        }
      };
    }, [playerRef]);
  
    return (
      <div data-vjs-player className={`w-100`}>
        <div ref={videoRef} />
      </div>
    );
}
  
