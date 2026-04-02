# Netflix-Style Web Application 🍿

A high-fidelity, cinematic Netflix clone built with **Next.js**, **React**, and **Tailwind CSS**. This application provides a premium streaming experience, sourcing metadata from the **TMDB API** and featuring integrated video playback via **VidLink**.

## ✨ Key Features

- **Dynamic Hero Banner**: Randomly rotating trending titles with real-time maturity ratings.
- **Global Discovery**: Browse by TV Shows, Movies, New & Popular, and specialized **Browse by Languages**.
- **Kids Mode**: One-click filtering to safe, age-appropriate content across all rows and search results.
- **Personalized List**: Persistent "My List" and "Continue Watching" rows synced with your account.
- **Cinematic Video Player**: Custom HLS.js player with authentic Netflix-style controls and adaptive streaming.
- **Secure Authentication**: Integrated Firebase Auth with Netflix-style sign-in validation.

## 🛠️ Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Database/Auth**: Firebase
- **API**: TMDB (The Movie Database)
- **Video**: VidLink & HLS.js

## 🚀 Deployment

This project is optimized for deployment on **Netlify**.
- Build Command: `npm run build`
- Publish Directory: `.next`

Be sure to set your `TMDB_API_KEY` and `NEXT_PUBLIC_FIREBASE_*` environment variables in your hosting provider!

---
🍿 Enjoy your cinematic experience!
