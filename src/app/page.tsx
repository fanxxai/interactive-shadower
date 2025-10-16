// src/app/page.tsx

// Import the component (Note: NO curly braces {})
import FaceReactiveDots from '../components/FaceReactiveDots'; 

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-0">
      <FaceReactiveDots />
    </main>
  );
}