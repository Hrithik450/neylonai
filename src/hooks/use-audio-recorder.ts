"use client";

import React from "react";

interface AudioRecorderProps {
  isRecording: boolean;
  classicLoading: boolean;
  toggleRecording: () => void;
  streamRef: React.RefObject<MediaStream | null>;
  setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
  setClassicLoading: React.Dispatch<React.SetStateAction<boolean>>;
  audioChunksRef: React.RefObject<Blob[]>;
  recognitionRef: React.RefObject<any>;
}

export function useAudioRecorder(
  speechToText?: () => void,
  onTranscriptUpdate?: (value: string) => void
): AudioRecorderProps {
  const [isRecording, setIsRecording] = React.useState<boolean>(false);
  const [classicLoading, setClassicLoading] = React.useState<boolean>(false);

  const recognitionRef = React.useRef<any>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        let finalTranscript = "";

        recognition.onresult = (event: any) => {
          let interimTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i][0].isiFinal) {
              finalTranscript += transcript + " ";
            } else {
              interimTranscript += transcript;
            }
          }

          if (typeof onTranscriptUpdate === "function") {
            onTranscriptUpdate(finalTranscript + interimTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }

    const setupRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          if (typeof speechToText === "function") {
            speechToText();
          }
        };
      } catch (error) {
        console.error("Error setting up media recorder:", error);
        alert(
          "Microphone access denied. Please enable it in your browser settings to use voice input."
        );
      }
    };

    setupRecorder();

    return () => {
      recognitionRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [onTranscriptUpdate, speechToText]);

  const toggleRecording = React.useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    const recognition = recognitionRef.current;

    if (!recognition) {
      console.warn("Speech recognition is not initialized");
      return;
    }

    if (!mediaRecorder) {
      console.warn("MediaRecorder not initialized.");
      return;
    }

    if (isRecording) {
      mediaRecorder.stop();
      recognition.stop();
      setClassicLoading(true);
    } else {
      audioChunksRef.current = [];
      mediaRecorder.start();
      recognition.start();
      setIsRecording(true);
    }
  }, [isRecording]);

  return {
    isRecording,
    classicLoading,
    toggleRecording,
    streamRef,
    setClassicLoading,
    setIsRecording,
    audioChunksRef,
    recognitionRef,
  };
}
