"use client";

import { useState, useEffect } from "react";

interface GreetingProps {
  firstName: string;
}

export function Greeting({ firstName }: GreetingProps) {
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    const updateGreeting = () => {
      const currentHour = new Date().getHours();
      if (currentHour < 12) {
        setGreeting("Good morning");
      } else if (currentHour < 18) {
        setGreeting("Good afternoon");
      } else {
        setGreeting("Good evening");
      }
    };

    // Set initial greeting
    updateGreeting();

    // Update greeting every minute to handle edge cases
    const interval = setInterval(updateGreeting, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <p className="text-white/80 text-sm font-medium mb-1">{greeting},</p>
      <h1 className="text-3xl font-bold mb-2">{firstName}</h1>
    </>
  );
}
