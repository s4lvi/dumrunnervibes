"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">DUM RUNNER</h1>
      <p className="text-xl mb-8">
        A 3D Dungeon Crawler and Tower Defense Game
      </p>

      <Link
        href="/game"
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
      >
        Play Game
      </Link>

      <div className="mt-12 max-w-2xl text-center">
        <h2 className="text-2xl font-semibold mb-4">Game Modes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-medium mb-2">Dum Running</h3>
            <p>
              Explore procedurally generated dungeons, fight robots, and collect
              AI cores.
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-medium mb-2">Mainframe Defense</h3>
            <p>
              Place towers with captured AI cores to defend your base against
              waves of enemies.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
