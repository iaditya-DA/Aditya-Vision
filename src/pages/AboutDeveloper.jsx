import { useNavigate } from "react-router-dom";
import { ArrowLeft, Handshake } from "lucide-react";

const ADITYA = {
  name: "Aditya Kumar Jha",
  role: "Android Developer",
  email: "adityakrjhaa@gmail.com",
  phoneDisplay: "+91 74920 01966",
  phoneLink: "tel:+917492001966",
  linkedin: "https://www.linkedin.com/in/adityakr-jha/",
  instagram: "https://www.instagram.com/adityakrjhaa/",
};

const ABHISHEK = {
  name: "Abhishek Kumar Jha",
  role: "Accountant",
  company: "Aditya Vision Pvt Ltd",
  email: "",
  phone: "",
};

const whatWeBuild = [
  {
    title: "Delivery Systems",
    desc: "Delivery tracking, driver assignment and payment management tools.",
    tag: "Built by Aditya, guided by Abhishek's accounting insight",
  },
  {
    title: "CRM Software",
    desc: "Custom CRMs to manage customers, records and daily operations.",
    tag: "Built by Aditya, guided by Abhishek's accounting insight",
  },
  {
    title: "Portfolio Websites",
    desc: "Clean, fast and responsive websites that present your work well.",
  },
  {
    title: "Mobile Apps",
    desc: "Native Android apps built with Kotlin, Java, Jetpack and Firebase.",
  },
];

const LinkedInIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.45 1.45 0 0 0 1.45-1.45c0-.8-.66-1.45-1.45-1.45s-1.45.65-1.45 1.45.65 1.45 1.45 1.45m1.39 9.74v-8.37H5.07v8.37h2.78z" />
  </svg>
);

const InstagramIcon = () => (
  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const Detail = ({ label, children }) => (
  <div>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
    <div className="text-sm font-medium text-gray-800 mt-0.5">{children}</div>
  </div>
);

const AboutDeveloper = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  };

  return (
    <div className="w-full min-h-[calc(100vh-7rem)] flex flex-col px-4 sm:px-6 lg:px-8 xl:px-10 pb-12">
      <div>
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center w-full">
        {/* Title and Subtitle */}
        <div className="text-center mt-2 sm:mt-0">
          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-semibold text-gray-900">
            Meet the Team
          </h1>
          <p className="mt-3 text-base sm:text-lg xl:text-xl text-gray-600 max-w-3xl mx-auto px-2">
            Developed by Aditya Kumar Jha in collaboration with Abhishek Kumar Jha, Accountant at Aditya Vision Pvt Ltd
          </p>
        </div>

        {/* 3 Columns: About the collaboration | Center photos | Details */}
        <div className="mt-10 lg:mt-14 grid grid-cols-1 lg:grid-cols-[1.1fr_auto_0.9fr] gap-10 lg:gap-10 xl:gap-16 items-center">
          {/* Column 1: About the collaboration */}
          <div className="order-2 lg:order-1 lg:pl-4 xl:pl-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              About the collaboration
            </h2>
            <div className="space-y-3.5 text-[15px] xl:text-base leading-relaxed text-gray-600">
              <p>
                I&apos;m an Android Developer who builds scalable, high-performance
                mobile applications using Kotlin, Java, Jetpack, Firebase, Retrofit
                and Room Database. I have a strong grasp of modern Android
                architecture, API integration and responsive UI development.
              </p>
              <p>
                Abhishek Kumar Jha, Accountant at Aditya Vision Pvt Ltd, contributed the
                business and accounting requirements, workflows and real-world feedback,
                which made the software practical and business-ready.
              </p>
              <p className="font-semibold text-gray-900 pt-1">
                Technology + accounting expertise = software that actually fits business needs.
              </p>
            </div>
          </div>

          {/* Column 2: Center Photo Section (Overlapping Photos + Handshake Badge) */}
          <div className="order-1 lg:order-2 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center py-2">
              {/* Photo 1: Aditya */}
              <div className="w-40 h-40 sm:w-48 sm:h-48 xl:w-56 xl:h-56 rounded-full overflow-hidden bg-[#E5E5E7] shrink-0 ring-4 ring-white shadow-md z-10">
                <img
                  src="/developer.jpg"
                  onError={(e) => {
                    if (e.currentTarget.src.endsWith(".jpg")) {
                      e.currentTarget.src = "/developer.jpeg";
                    }
                  }}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: "center 8%" }}
                  alt="Aditya Kumar Jha"
                />
              </div>

              {/* Central Handshake Badge */}
              <div
                className="absolute z-30 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-md flex items-center justify-center text-[#E53935] border border-gray-100"
                title="Collaboration"
              >
                <Handshake className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>

              {/* Photo 2: Abhishek */}
              <div className="w-40 h-40 sm:w-48 sm:h-48 xl:w-56 xl:h-56 rounded-full overflow-hidden bg-[#E5E5E7] shrink-0 ring-4 ring-white shadow-md -ml-8 sm:-ml-10 xl:-ml-12 z-20">
                <img
                  src="/abhishek.jpg"
                  onError={(e) => {
                    if (e.currentTarget.src.endsWith(".jpg")) {
                      e.currentTarget.src = "/abhishek.jpeg";
                    }
                  }}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: "center 15%" }}
                  alt="Abhishek Kumar Jha"
                />
              </div>
            </div>

            {/* Captions below the photos */}
            <div className="mt-4 text-center space-y-1">
              <p className="text-xs sm:text-sm font-medium text-gray-700">
                <span className="font-semibold text-gray-900">Aditya Kumar Jha</span> &ndash; Android Developer
              </p>
              <p className="text-xs sm:text-sm font-medium text-gray-700">
                <span className="font-semibold text-gray-900">Abhishek Kumar Jha</span> &ndash; Accountant, Aditya Vision Pvt Ltd
              </p>
            </div>
          </div>

          {/* Column 3: Right Column Details */}
          <div className="order-3 lg:justify-self-end lg:pr-4 xl:pr-8 lg:w-full lg:max-w-[340px]">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>

            <div className="space-y-6">
              {/* Developer Block */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#E53935] mb-2.5">
                  Developer
                </h3>
                <div className="space-y-2.5">
                  <Detail label="Name">{ADITYA.name}</Detail>
                  <Detail label="Role">{ADITYA.role}</Detail>
                  <Detail label="Email">
                    <a
                      href={`mailto:${ADITYA.email}`}
                      className="hover:text-[#E53935] transition-colors break-all"
                    >
                      {ADITYA.email}
                    </a>
                  </Detail>
                  <Detail label="Phone">
                    <a
                      href={ADITYA.phoneLink}
                      className="hover:text-[#E53935] transition-colors"
                    >
                      {ADITYA.phoneDisplay}
                    </a>
                  </Detail>
                </div>

                <div className="flex items-center gap-4 mt-3 text-gray-900">
                  <a
                    href={ADITYA.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn"
                    className="hover:text-[#E53935] transition-colors"
                  >
                    <LinkedInIcon />
                  </a>
                  <a
                    href={ADITYA.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="hover:text-[#E53935] transition-colors"
                  >
                    <InstagramIcon />
                  </a>
                </div>
              </div>

              {/* Collaborator Block */}
              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5">
                  Collaborator
                </h3>
                <div className="space-y-2.5">
                  <Detail label="Name">{ABHISHEK.name}</Detail>
                  <Detail label="Role">{ABHISHEK.role}</Detail>
                  <Detail label="Company">{ABHISHEK.company}</Detail>
                  {ABHISHEK.email && (
                    <Detail label="Email">
                      <a
                        href={`mailto:${ABHISHEK.email}`}
                        className="hover:text-[#E53935] transition-colors break-all"
                      >
                        {ABHISHEK.email}
                      </a>
                    </Detail>
                  )}
                  {ABHISHEK.phone && (
                    <Detail label="Phone">
                      <a
                        href={`tel:${ABHISHEK.phone}`}
                        className="hover:text-[#E53935] transition-colors"
                      >
                        {ABHISHEK.phone}
                      </a>
                    </Detail>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* What we build */}
        <div className="mt-14 lg:mt-20 lg:px-6 xl:px-10">
          <h2 className="text-center text-2xl xl:text-3xl font-semibold text-gray-900">
            What we build
          </h2>
          <p className="mt-2 text-center text-base text-gray-600">
            Software that solves real business problems.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
            {whatWeBuild.map((item, i) => (
              <div key={item.title} className="flex flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-400 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-1.5 text-lg font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600">
                    {item.desc}
                  </p>
                </div>
                {item.tag && (
                  <p className="mt-3 text-xs text-gray-500 italic border-t border-gray-100 pt-2">
                    {item.tag}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Call to action */}
        <div className="mt-14 lg:mt-20 text-center">
          <h2 className="text-xl xl:text-2xl font-semibold text-gray-900">
            Have a project in mind?
          </h2>
          <p className="mt-2 text-base xl:text-lg text-gray-600 max-w-2xl mx-auto">
            Whether it&apos;s an app, a CRM, a delivery system or a portfolio
            website, give us a chance to work on it and we will deliver it with
            quality.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`mailto:${ADITYA.email}?subject=Project%20Opportunity`}
              className="inline-flex items-center h-11 px-7 rounded-lg bg-[#E53935] text-white text-sm font-medium hover:bg-[#D32F2F] transition-colors"
            >
              Hire us
            </a>
            <a
              href={ADITYA.phoneLink}
              className="inline-flex items-center h-11 px-7 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Call us
            </a>
          </div>
        </div>

        {/* Footer line */}
        <div className="mt-14 pt-8 border-t border-gray-100 text-center">
          <p className="text-gray-400 text-sm">
            Developed by Aditya Kumar Jha in collaboration with Abhishek Kumar Jha, Accountant, Aditya Vision Pvt Ltd
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutDeveloper;
