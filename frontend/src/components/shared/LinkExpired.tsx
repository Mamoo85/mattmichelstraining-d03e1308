import { Link } from "react-router-dom";

const LinkExpired = () => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
    <p className="text-2xl font-bold">Link Expired</p>
    <p className="text-muted-foreground">This link is no longer valid. Please request a new one.</p>
    <Link to="/" className="text-primary underline text-sm">Go home</Link>
  </div>
);
export default LinkExpired;
