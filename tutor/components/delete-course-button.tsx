"use client";

import { deleteCourse } from "@/app/actions/courses";
import { Button } from "@/components/ui";

export default function DeleteCourseButton({ courseId }: { courseId: string }) {
  return (
    <form
      action={deleteCourse}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "This permanently deletes the course, its documents and all study material. Continue?",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="courseId" value={courseId} />
      <Button type="submit" variant="danger" size="sm">
        Delete course
      </Button>
    </form>
  );
}
