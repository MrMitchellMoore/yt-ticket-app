import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    // Full-screen 404 page with centered content and dynamic image with back to home link
    <div className="flex flex-col bg-white w-full">
      <div className="relative flex flex-col justify-center items-center w-full">
        <Image
          src="/notfound.jpg"
          alt="404 Not Found Illustration"
          width={800}
          height={600}
          className="object-cover"
        />
      </div>
      <div className="flex items-center justify-center gap-4 py-6">
        <Link
          href="/"
          className="bg-blue-600 text-white py-1.5 px-5 rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
