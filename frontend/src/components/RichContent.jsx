import { useEffect, useState } from "react";

export const RichContent = ({ html, testId }) => {
  const [clean, setClean] = useState("");
  useEffect(() => {
    if (!html) return;
    import("dompurify").then(({ default: DOMPurify }) => setClean(DOMPurify.sanitize(html, { ADD_ATTR: ["target"] })));
  }, [html]);
  if (!html) return null;
  return <div className="rich-content" data-testid={testId} dangerouslySetInnerHTML={{ __html: clean }} />;
};
