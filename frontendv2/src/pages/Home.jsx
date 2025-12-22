import { useAuth } from "../context/AuthContext";
import Home1 from "../components/Home/Home1";
import Home2 from "../components/Home/Home2";
import Home3 from "../components/Home/Hero3";
import Home4 from "../components/Home/Hero4";
import Home5 from "../components/Home/Hero5";
import Home6 from "../components/Home/Home6";
import Navbar from "../components/common/Navbar";
import Footer from "../components/common/Footer";

const Home = () => {
  const { loading } = useAuth();

  // Show loader while auth is loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Always show homepage - logged in users can view it too
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Home1 />
      <Home2 />
      <Home3 />
      <Home4 />
      <Home5 />
      <Home6 />
      <Footer />
    </div>
  );
};

export default Home;
