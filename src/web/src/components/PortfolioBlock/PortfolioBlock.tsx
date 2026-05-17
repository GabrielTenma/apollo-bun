import { useState, useEffect, ReactNode } from "react";
import Markdown from "react-markdown";
import Gfm from "remark-gfm";

interface ContentItem {
  name: string;
  value: string;
}

interface CompletionApiResponse {
  success: boolean;
  data: ContentItem[];
  message?: string;
  correlation_id: string;
  timestamp: string;
  status_code: number;
}

const TABLE_CLS = "table table-xs table-pin-rows table-pin-cols";

/* ------------------------------------------------------------------ */
/*  react-markdown custom renderers                                   */
/* ------------------------------------------------------------------ */

function MarkdownElTable({ children }: { children?: ReactNode }) {
  return (
    <div className="my-4 w-full overflow-x-auto rounded-btn">
      <table className={TABLE_CLS}>{children}</table>
    </div>
  );
}

function MarkdownElTh({ children }: { children?: ReactNode }) {
  return <th className="!text-wrap">{children}</th>;
}

function MarkdownElTd({ children }: { children?: ReactNode }) {
  return <td className="!text-wrap">{children}</td>;
}

function MarkdownElThead({ children }: { children?: ReactNode }) {
  return <thead>{children}</thead>;
}

function MarkdownElTbody({ children }: { children?: ReactNode }) {
  return <tbody>{children}</tbody>;
}

function MarkdownElTfoot({ children }: { children?: ReactNode }) {
  return <tfoot>{children}</tfoot>;
}

function MarkdownElTr({ children }: { children?: ReactNode }) {
  return <tr>{children}</tr>;
}

function MarkdownElP({ children }: { children?: ReactNode }) {
  return <p>{children}</p>;
}

const markdownComponents = {
  table: MarkdownElTable,
  th: MarkdownElTh,
  td: MarkdownElTd,
  thead: MarkdownElThead,
  tbody: MarkdownElTbody,
  tfoot: MarkdownElTfoot,
  tr: MarkdownElTr,
  p: MarkdownElP,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PortfolioBlock() {
  const [latest, setLatest] = useState<string>("");
  const [previous, setPrevious] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          "http://localhost:3000/api/v1/openrouter/completion",
        );
        const json: CompletionApiResponse = await response.json();

        if (json.success && Array.isArray(json.data)) {
          for (const item of json.data) {
            if (item.name === "latest") setLatest(item.value);
            if (item.name === "previous") setPrevious(item.value);
          }
        }

        console.debug("Fetch OK:", json);
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="bg-base-100 py-8 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-10">
          {/* Header Section */}
          <div className="mb-12 space-y-4 sm:mb-16 lg:mb-24">
            <div>
              <span className="badge badge-soft badge-primary rounded-full font-semibold">
                Apollo Watcher
              </span>
            </div>
          </div>

          {/* Project Details Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-1">

            {/* Project Information */}
            <div className="space-y-6 px-6">
              <h3 className="text-base-content text-3xl font-semibold">
                Latest Completion
              </h3>
              <Markdown
                remarkPlugins={[Gfm]}
                components={markdownComponents}
              >
                {loading
                  ? "Loading..."
                  : latest || "No latest completion available"}
              </Markdown>

              <hr className="border-base-content/20" />

              {/* Project Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-base-content w-22 font-semibold">
                    Correlation:
                  </span>
                  <span className="text-base-content/80">
                    {latest && previous ? "Has previous" : "No previous data"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
