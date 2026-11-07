"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATS, LEVELS } from "@/lib/data";
import { prepareThumbnail } from "@/lib/image";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MAX_PROMO_MIN, MAX_VIDEO_MB, errorMessage, fmtDuration, readDuration, uploadToGumlet, videoProblem } from "@/lib/upload";
import { DISPLAY, T } from "@/lib/theme";
import { useAuth } from "../auth";
import { Checkbox, Field, FormError, Textarea } from "../auth-ui";

const select: React.CSSProperties = { width: "100%", padding: "14px 18px", borderRadius: 14, border: "1.5px solid oklch(0.88 0.03 300)", fontSize: 15, background: "#fff", color: T.ink };

export default function NewCourseForm() {
  const router = useRouter();
  const { token } = useAuth();
  const createM = useMutation(api.courses.create);
  const createUpload = useAction(api.uploads.createUpload);
  const [promo, setPromo] = useState<File | null>(null);
  const [promoSecs, setPromoSecs] = useState(0);
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState(CATS[0].name);
  const [level, setLevel] = useState("Beginner");
  const [price, setPrice] = useState("2499");
  const [description, setDescription] = useState("");
  const [thumb, setThumb] = useState("");
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const r = await prepareThumbnail(f);
    if (r.ok) {
      setThumb(r.dataUrl);
      setErrors((e) => ({ ...e, thumb: "" }));
    } else {
      setThumb("");
      setErrors((e) => ({ ...e, thumb: r.error }));
    }
  };

  const onPromo = async (f: File | undefined) => {
    if (!f) return;
    const secs = await readDuration(f);
    const bad = videoProblem(f, MAX_PROMO_MIN * 60, secs);
    setPromo(bad ? null : f);
    setPromoSecs(bad ? 0 : secs);
    setErrors((e) => ({ ...e, promo: bad ?? "" }));
  };

  const save = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!token) return;
    const errs: Record<string, string> = {};
    if (title.trim().length < 8) errs.title = "Give your course a clear title (at least 8 characters).";
    if (subtitle.trim().length < 10) errs.subtitle = "Add a one-line subtitle.";
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0 || p > 99999) errs.price = "Enter a price between 0 and 99,999.";
    if (description.trim().length < 60) errs.description = `Describe what learners will get (at least 60 characters — ${description.trim().length} so far).`;
    if (!thumb) errs.thumb = errs.thumb || "Upload a course image.";
    if (!promo) errs.promo = errs.promo || `Upload a promo video (up to ${MAX_PROMO_MIN} minutes).`;
    if (!rights) errs.rights = "Please confirm the content is yours and follows our guidelines.";
    setErrors(errs);
    setFormError("");
    if (Object.values(errs).some(Boolean)) return;

    setBusy(true);
    try {
      const promoUp = await uploadToGumlet(promo!, () => createUpload({ token, kind: "promo" }), setStatus);
      const r = await createM({
        token,
        title: title.trim(),
        subtitle: subtitle.trim(),
        category,
        level,
        price: p,
        description: description.trim(),
        thumbnail: thumb,
        promoAssetId: promoUp.assetId,
        promoSize: promoUp.size,
        promoDuration: promoSecs,
      });
      if (!r.ok) {
        setBusy(false);
        return setFormError(r.error);
      }
      router.push(`/instructor/course/${r.id}`); // next: add sections and lessons
    } catch (err) {
      setBusy(false);
      setFormError(errorMessage(err, "We couldn’t save the course. Please try again."));
    }
  };

  const label = (t: string) => <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t}</div>;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "10px 40px 60px" }}>
      <Link href="/instructor" style={{ fontSize: 14, fontWeight: 700 }}>
        ← Instructor studio
      </Link>
      <div style={{ font: `800 40px ${DISPLAY}`, letterSpacing: "-.03em", margin: "10px 0 6px" }}>Create a course</div>
      <div style={{ color: T.muted2, marginBottom: 22 }}>Step 1 of 2: course details and a short promo. Next you’ll add lessons, then send everything to our team for review. Nothing goes public until every lesson is approved.</div>

      <form onSubmit={(e) => e.preventDefault()} noValidate style={{ background: "#fff", borderRadius: 30, padding: 30 }}>
        <FormError>{formError}</FormError>
        <Field label="Course title" value={title} onChange={setTitle} error={errors.title} placeholder="e.g. Complete Python Bootcamp: Zero to Hero" />
        <Field label="Subtitle" value={subtitle} onChange={setSubtitle} error={errors.subtitle} placeholder="One line that sells the course" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 16, marginBottom: 16 }}>
          <div>
            {label("Category")}
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={select}>
              {CATS.map((c) => (
                <option key={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            {label("Level")}
            <select value={level} onChange={(e) => setLevel(e.target.value)} style={select}>
              {[...LEVELS.slice(1), "All Levels"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <Field label="Price (₹ INR)" value={price} onChange={setPrice} error={errors.price} type="text" />
        </div>
        <Textarea label="Description" rows={6} value={description} onChange={setDescription} error={errors.description} placeholder="What will learners build or be able to do after this course?" />

        <div style={{ marginBottom: 16 }}>
          {label("Course image")}
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 192, height: 108, borderRadius: 16, background: "oklch(0.93 0.03 300)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: T.muted, fontSize: 12, flex: "none" }}>
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="Course preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                "No image"
              )}
            </div>
            <div>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0])} />
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>JPG, PNG or WebP · max 3 MB · at least 480 × 270. Images are checked by our team before your course goes live.</div>
            </div>
          </div>
          {errors.thumb && (
            <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginTop: 6 }}>
              {errors.thumb}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          {label("Promo video")}
          <input type="file" accept="video/mp4,video/webm" onChange={(e) => onPromo(e.target.files?.[0])} />
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
            MP4 video · up to {MAX_PROMO_MIN} minutes · max {MAX_VIDEO_MB} MB. Large HD files can take a few minutes to prepare, so keep this tab open until the upload finishes. This is the free preview shown on your course page — our team reviews your lessons, not just the promo.
          </div>
          {promo && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{promo.name} · {fmtDuration(promoSecs)}</div>}
          {errors.promo && (
            <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginTop: 6 }}>
              {errors.promo}
            </div>
          )}
        </div>

        <Checkbox checked={rights} onChange={setRights} error={errors.rights}>
          I own the rights to this content and it follows QuickAI’s <b>Content Guidelines</b> — no explicit, hateful, harassing or illegal material.
        </Checkbox>

        <button onClick={save} disabled={busy} className="btn-hover" style={{ width: "100%", border: 0, background: T.purple, color: "#fff", borderRadius: 99, padding: 14, fontWeight: 800, fontSize: 15, fontFamily: "inherit", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
          {busy ? status || "Saving…" : "Save & add lessons →"}
        </button>
      </form>
    </div>
  );
}
