import logo from "../logo-blue.png";
import Image from "next/image";
import AuthButtons from "./AuthModal";

export default function Navbar() {
  return (
    <header className="bg-white font-bold flex justify-between shrink-0">
      <div className="flex p-3">
        <Image className="h-9 w-9" src={logo} alt="Logo" />
        <div className="text-blue-400 font-bold text-xl p-1">logitlensviz</div>
      </div>
      <div className="space-x-3 p-3 flex items-center">
        <AuthButtons />
      </div>
    </header>
  );
}
