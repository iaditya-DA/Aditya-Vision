import { useNavigate } from "react-router-dom";
import { Construction } from "lucide-react";
import PageHeader from "../../components/layout/PageHeader";
import EmptyState from "../../components/common/EmptyState";
import Button from "../../components/common/Button";

const PlaceholderPage = ({
  title = "Module",
  section = "Operations",
  description = "This module is scheduled for development in Part 2 of the Aditya Vision implementation.",
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </Button>
      </PageHeader>

      <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs">
        <EmptyState
          icon={Construction}
          title={`${title} Module (${section})`}
          description={`${description} In Part 1, the complete design system, global layout, navigation, mock login, and the complete business Dashboard are fully functional.`}
          actionLabel="Go to Dashboard"
          onAction={() => navigate("/dashboard")}
        />
      </div>
    </div>
  );
};

export default PlaceholderPage;
