// 放到文件顶部 imports 之后，或者单独抽成 components/CSVUploader.tsx
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";
import { toast } from "@/hooks/use-toast";          // 如果想在解析错误时提示

function CSVUploader({
  onParsed,
}: {
  onParsed: (rows: { address: string; amount: string }[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCSV = (file: File) => {
    import("papaparse").then(({ default: Papa }) => {
      Papa.parse(file, {
        complete(res) {
          const rows: { address: string; amount: string }[] = [];
          res.data.forEach((row: any) => {
            if (Array.isArray(row) && row.length >= 2) {
              rows.push({
                address: String(row[0]).trim(),
                amount: String(row[1]).trim(),
              });
            }
          });
          if (rows.length === 0) {
            toast({ title: "Invalid CSV file" });
            return;
          }
          onParsed(rows);
        },
      });
    });
  };

  return (
    <>
      {/* 真·文件输入 */}
      <input
        type="file"
        accept=".csv,text/csv"
        ref={fileRef}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleCSV(file);
          e.target.value = "";
        }}
      />

      {/* 选择文件 */}
      <Button variant="outline" onClick={() => fileRef.current?.click()}>
        <UploadCloud size={16} className="mr-1" />
        Choose file
      </Button>
    </>
  );
}
