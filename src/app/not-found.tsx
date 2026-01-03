export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900 text-white">
      <div className="text-center max-w-md px-4">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl mb-2">Page Not Found</p>
        <p className="text-zinc-400 mb-6">
          Please provide a valid website URL in the format:
        </p>
        <code className="bg-zinc-800 px-4 py-2 rounded block mb-4">
          http://localhost:3000/https:/example.com
        </code>
        <a 
          href="/" 
          className="text-blue-400 hover:text-blue-300 underline"
        >
          Go back home
        </a>
      </div>
    </div>
  );
}
