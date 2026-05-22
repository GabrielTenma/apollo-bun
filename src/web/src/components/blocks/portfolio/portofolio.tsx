import { useState, useEffect, ReactNode, useCallback, memo } from "react";
import Markdown from "react-markdown";
import Gfm from "remark-gfm";
import StickyNavBar from "../navigation-bar/stickynavbar";
import React from "react";

const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;
const COMPLETION_URL = '/api/v1/openrouter/completion';

interface ContentItem {
  latest: string;
  previous: string;
}

interface CompletionApiResponse {
  success: boolean;
  data: ContentItem;
  correlation_id: string;
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
  return <th className="text-wrap!">{children}</th>;
}

function MarkdownElTd({ children }: { children?: ReactNode }) {
  return <td className="text-wrap!">{children}</td>;
}

function MarkdownElThead({ children }: { children?: ReactNode }) {
  return <thead className="z-auto">{children}</thead>;
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

const MarkdownView = React.memo(function MarkdownView({ content }: { content: string }) {
  return (
    <Markdown remarkPlugins={[Gfm]} components={markdownComponents}>
      {content || "No latest completion available"}
    </Markdown>
  );
});

export default React.memo(function PortfolioBlock() {
  const [latest, setLatest] = useState<string>("");
  const [correlationId, setCorrelationId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setError("");
    const res = await fetch(COMPLETION_URL, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: CompletionApiResponse = await res.json();
    if (!json.success) throw new Error(json.success === false ? (json as any).message : 'Unknown error');
    setLatest(json.data.latest);
    setCorrelationId(json.correlation_id)
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    let attempt = 0;
    const run = async () => {
      try {
        await fetchData(controller.signal);
      } catch (e: any) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        attempt++;
        if (attempt <= RETRY_ATTEMPTS) {
          await new Promise<void>((r) => setTimeout(r, RETRY_DELAY_MS));
          return run();
        }
        setError(e.message ?? 'Failed to load');
      }
    };

    run();
    return () => controller.abort();
  }, [fetchData]);

  return (
    <>
      <StickyNavBar />
      <div className="bg-base-100 py-8 sm:py-16 lg:py-10 z-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-5">

            {/* Project Details Section */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-1">

              {/* Project Information */}
              <div className="space-y-6 px-6">
                <h3 className="text-base-content text-3xl font-semibold">
                  Latest Completion
                </h3>
                <MarkdownView content={latest} />

                <hr className="border-base-content/20" />

                {/* Project Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-base-content w-22 font-semibold">
                      Correlation:
                    </span>
                    <span className="text-base-content/80">
                      {correlationId ?? 'Not Available'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
