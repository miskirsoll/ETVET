import type { CourseExportData } from "./types";

export function generateIndexHtml(courseData: CourseExportData): string {
  const escapedTitle = courseData.title.replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapedTitle}</title>
<link rel="stylesheet" href="styles.css" />
</head>
<body>
<div id="app"></div>
<script id="etvet-course-data" type="application/json">${JSON.stringify(courseData).replace(/</g, "\\u003c")}</script>
<script src="scorm-api.js"></script>
<script src="suspend-data.js"></script>
<script src="player.js"></script>
</body>
</html>
`;
}

export function generateStylesCss(): string {
  return `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #fff; color: #171717; }
#app { display: flex; min-height: 100vh; }
.etvet-sidebar { width: 220px; flex-shrink: 0; border-right: 1px solid #e5e5e5; padding: 16px; overflow-y: auto; }
.etvet-sidebar h2 { font-size: 12px; text-transform: uppercase; color: #737373; margin: 12px 0 4px; }
.etvet-sidebar ul { list-style: none; margin: 0; padding: 0; }
.etvet-sidebar li { margin: 2px 0; }
.etvet-sidebar a, .etvet-sidebar a:visited { color: #171717; text-decoration: none; cursor: pointer; font-size: 14px; }
.etvet-sidebar a:hover { text-decoration: underline; }
.etvet-sidebar li.active a { font-weight: 600; text-decoration: underline; }
.etvet-main { flex: 1; padding: 24px; max-width: 760px; }
.etvet-block { margin: 0 0 24px; }
.etvet-block img, .etvet-block video, .etvet-block audio { max-width: 100%; }
.etvet-block blockquote { border-left: 4px solid #d4d4d4; padding-left: 16px; font-style: italic; margin: 0; }
.etvet-block .statement { background: #f5f5f5; padding: 16px; border-radius: 6px; font-size: 18px; font-weight: 500; }
.etvet-btn { display: inline-block; background: #171717; color: #fff; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; cursor: pointer; text-decoration: none; }
.etvet-btn:disabled { opacity: 0.5; cursor: default; }
.etvet-btn-outline { background: transparent; color: #171717; border: 1px solid #d4d4d4; }
.etvet-question { border: 1px solid #e5e5e5; border-radius: 6px; padding: 16px; margin: 0 0 16px; }
.etvet-result-pass { background: #dcfce7; color: #166534; padding: 12px; border-radius: 6px; }
.etvet-result-fail { background: #fee2e2; color: #991b1b; padding: 12px; border-radius: 6px; }
.etvet-locked { color: #a3a3a3; }
`.trim();
}

export function generatePlayerJs(): string {
  return `
"use strict";

(function () {
  var courseData = JSON.parse(document.getElementById("etvet-course-data").textContent);
  var app = document.getElementById("app");

  var lessons = [];
  courseData.sections.forEach(function (section) {
    section.lessons.forEach(function (lesson) {
      lessons.push({ section: section, lesson: lesson });
    });
  });
  var quizIndices = [];
  lessons.forEach(function (entry, i) {
    if (entry.lesson.type === "QUIZ") quizIndices.push(i);
  });

  ScormAPI.initialize();
  var startTime = Date.now();
  var raw = ScormAPI.get("cmi.suspend_data");
  var state = etvetDecodeSuspendData(raw, lessons.length, quizIndices.length);

  function quizScoreIndex(lessonIndex) {
    return quizIndices.indexOf(lessonIndex);
  }

  function persist() {
    ScormAPI.set("cmi.suspend_data", etvetEncodeSuspendData(state));
    ScormAPI.set("cmi.core.lesson_status", overallStatus());
    var avgScore = averageScore();
    if (avgScore !== null) {
      ScormAPI.set("cmi.core.score.raw", String(avgScore));
    }
    ScormAPI.commit();
  }

  function averageScore() {
    var attempted = state.quizScores.filter(function (s) {
      return s >= 0;
    });
    if (attempted.length === 0) return null;
    var sum = attempted.reduce(function (a, b) {
      return a + b;
    }, 0);
    return Math.round(sum / attempted.length);
  }

  function overallStatus() {
    if (state.lessonStatuses.indexOf("2") !== -1) return "failed";
    var allDone = state.lessonStatuses.every(function (c) {
      return c === "1";
    });
    if (allDone) return quizIndices.length > 0 ? "passed" : "completed";
    return "incomplete";
  }

  function renderSidebar() {
    var container = document.createElement("div");
    container.className = "etvet-sidebar";
    courseData.sections.forEach(function (section) {
      var h2 = document.createElement("h2");
      h2.textContent = section.title;
      container.appendChild(h2);
      var ul = document.createElement("ul");
      section.lessons.forEach(function (lesson) {
        var index = lessons.findIndex(function (e) {
          return e.lesson.id === lesson.id;
        });
        var li = document.createElement("li");
        if (index === state.currentLessonIndex) li.className = "active";
        var a = document.createElement("a");
        var status = state.lessonStatuses[index];
        var badge = status === "1" ? "\\u2713 " : status === "2" ? "\\u2717 " : "";
        a.textContent = badge + lesson.title;
        a.addEventListener("click", function () {
          state.currentLessonIndex = index;
          persist();
          render();
        });
        li.appendChild(a);
        ul.appendChild(li);
      });
      container.appendChild(ul);
    });
    return container;
  }

  function renderBlock(block, onContinue) {
    var el = document.createElement("div");
    el.className = "etvet-block";
    switch (block.type) {
      case "heading":
        var h = document.createElement("h2");
        h.textContent = block.content.text || "";
        el.appendChild(h);
        break;
      case "text":
        var p = document.createElement("p");
        p.style.whiteSpace = "pre-wrap";
        p.textContent = block.content.text || "";
        el.appendChild(p);
        break;
      case "statement":
        var s = document.createElement("p");
        s.className = "statement";
        s.textContent = block.content.text || "";
        el.appendChild(s);
        break;
      case "quote":
        var bq = document.createElement("blockquote");
        var qp = document.createElement("p");
        qp.textContent = block.content.text || "";
        bq.appendChild(qp);
        if (block.content.attribution) {
          var footer = document.createElement("footer");
          footer.textContent = "\\u2014 " + block.content.attribution;
          bq.appendChild(footer);
        }
        el.appendChild(bq);
        break;
      case "list":
        var ul2 = document.createElement("ul");
        (block.content.items || []).forEach(function (item) {
          var li2 = document.createElement("li");
          li2.textContent = item;
          ul2.appendChild(li2);
        });
        el.appendChild(ul2);
        break;
      case "image":
        if (block.content.url) {
          var img = document.createElement("img");
          img.src = block.content.url;
          img.alt = block.content.alt || "";
          el.appendChild(img);
        }
        break;
      case "video":
        if (block.content.url) {
          var video = document.createElement("video");
          video.src = block.content.url;
          video.controls = true;
          el.appendChild(video);
        }
        break;
      case "audio":
        if (block.content.url) {
          var audio = document.createElement("audio");
          audio.src = block.content.url;
          audio.controls = true;
          el.appendChild(audio);
        }
        break;
      case "divider":
        el.appendChild(document.createElement("hr"));
        break;
      case "continue":
        var btn = document.createElement("button");
        btn.className = "etvet-btn";
        btn.textContent = block.content.label || "Continue";
        btn.addEventListener("click", onContinue);
        el.appendChild(btn);
        break;
      case "button":
        var link = document.createElement("a");
        link.className = "etvet-btn etvet-btn-outline";
        link.textContent = block.content.label || "Next";
        if (block.content.target_type === "url" && block.content.url) {
          link.href = block.content.url;
          link.target = "_blank";
          link.rel = "noreferrer";
        } else if (block.content.target_type === "lesson" && block.content.lesson_id) {
          link.href = "#";
          link.addEventListener("click", function (e) {
            e.preventDefault();
            var targetIndex = lessons.findIndex(function (entry) {
              return entry.lesson.id === block.content.lesson_id;
            });
            if (targetIndex !== -1) {
              state.currentLessonIndex = targetIndex;
              persist();
              render();
            }
          });
        } else {
          link.href = "#";
          link.addEventListener("click", function (e) {
            e.preventDefault();
            goToLesson(state.currentLessonIndex + 1);
          });
        }
        el.appendChild(link);
        break;
    }
    return el;
  }

  function renderBlockLesson(lesson, lessonIndex, container) {
    var segments = [[]];
    lesson.blocks.forEach(function (block) {
      segments[segments.length - 1].push(block);
      if (block.type === "continue") segments.push([]);
    });
    segments = segments.filter(function (s) {
      return s.length > 0;
    });

    var revealed = 1;

    function renderSegments() {
      var wrapper = document.createElement("div");
      for (var i = 0; i < Math.min(revealed, segments.length); i++) {
        (function (segIndex) {
          segments[segIndex].forEach(function (block) {
            wrapper.appendChild(
              renderBlock(block, function () {
                revealed = Math.max(revealed, segIndex + 2);
                rerender();
              })
            );
          });
        })(i);
      }
      return wrapper;
    }

    function rerender() {
      content.innerHTML = "";
      content.appendChild(renderSegments());
    }

    var content = document.createElement("div");
    content.appendChild(renderSegments());
    container.appendChild(content);

    var completeBtn = document.createElement("button");
    completeBtn.className = "etvet-btn";
    var isLast = lessonIndex === lessons.length - 1;
    completeBtn.textContent = isLast ? "Mark complete" : "Complete & continue \\u2192";
    completeBtn.addEventListener("click", function () {
      state.lessonStatuses[lessonIndex] = "1";
      persist();
      if (!isLast) goToLesson(lessonIndex + 1);
      else render();
    });
    container.appendChild(completeBtn);
  }

  function shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function renderQuizLesson(lesson, lessonIndex, container) {
    var pool = lesson.randomize_questions ? shuffle(lesson.questions) : lesson.questions;
    var active = lesson.draw_count ? pool.slice(0, lesson.draw_count) : pool;
    var answers = {};

    var form = document.createElement("div");
    active.forEach(function (question, qIndex) {
      var qEl = document.createElement("div");
      qEl.className = "etvet-question";
      var prompt = document.createElement("p");
      prompt.textContent = qIndex + 1 + ". " + question.prompt;
      qEl.appendChild(prompt);
      question.choices.forEach(function (choice) {
        var label = document.createElement("label");
        label.style.display = "block";
        var input = document.createElement("input");
        input.type = question.type === "multiple_response" ? "checkbox" : "radio";
        input.name = "q-" + question.id;
        input.addEventListener("change", function () {
          var list = answers[question.id] || [];
          if (question.type === "multiple_response") {
            list = input.checked
              ? list.concat([choice.id])
              : list.filter(function (id) {
                  return id !== choice.id;
                });
          } else {
            list = [choice.id];
          }
          answers[question.id] = list;
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + choice.text));
        qEl.appendChild(label);
      });
      form.appendChild(qEl);
    });
    container.appendChild(form);

    var submitBtn = document.createElement("button");
    submitBtn.className = "etvet-btn";
    submitBtn.textContent = "Submit";
    submitBtn.addEventListener("click", function () {
      var correctCount = 0;
      active.forEach(function (question) {
        var correctIds = question.choices
          .filter(function (c) {
            return c.is_correct;
          })
          .map(function (c) {
            return c.id;
          });
        var submitted = answers[question.id] || [];
        var isCorrect =
          correctIds.length === submitted.length &&
          correctIds.every(function (id) {
            return submitted.indexOf(id) !== -1;
          });
        if (isCorrect) correctCount++;
      });
      var score = active.length > 0 ? Math.round((correctCount / active.length) * 100) : 0;
      var passed = score >= lesson.pass_threshold;

      state.lessonStatuses[lessonIndex] = passed ? "1" : "2";
      var qsIndex = quizScoreIndex(lessonIndex);
      if (qsIndex !== -1) state.quizScores[qsIndex] = score;
      persist();

      form.style.display = "none";
      submitBtn.style.display = "none";
      var result = document.createElement("div");
      result.className = passed ? "etvet-result-pass" : "etvet-result-fail";
      result.textContent =
        "Score: " + score + "% \\u2014 " + (passed ? "Passed" : "Not passed") + " (needs " + lesson.pass_threshold + "%)";
      container.appendChild(result);

      if (passed && lessonIndex < lessons.length - 1) {
        var nextBtn = document.createElement("button");
        nextBtn.className = "etvet-btn";
        nextBtn.style.marginTop = "12px";
        nextBtn.textContent = "Next lesson \\u2192";
        nextBtn.addEventListener("click", function () {
          goToLesson(lessonIndex + 1);
        });
        container.appendChild(nextBtn);
      } else if (!passed) {
        var retryBtn = document.createElement("button");
        retryBtn.className = "etvet-btn etvet-btn-outline";
        retryBtn.style.marginTop = "12px";
        retryBtn.textContent = "Retry";
        retryBtn.addEventListener("click", render);
        container.appendChild(retryBtn);
      }
    });
    container.appendChild(submitBtn);
  }

  function goToLesson(index) {
    if (index < 0 || index >= lessons.length) return;
    state.currentLessonIndex = index;
    persist();
    render();
  }

  function render() {
    app.innerHTML = "";
    app.appendChild(renderSidebar());

    var main = document.createElement("div");
    main.className = "etvet-main";
    var entry = lessons[state.currentLessonIndex];
    if (!entry) {
      app.appendChild(main);
      return;
    }
    var h1 = document.createElement("h1");
    h1.textContent = entry.lesson.title;
    main.appendChild(h1);

    if (entry.lesson.type === "BLOCK") {
      renderBlockLesson(entry.lesson, state.currentLessonIndex, main);
    } else {
      renderQuizLesson(entry.lesson, state.currentLessonIndex, main);
    }
    app.appendChild(main);
  }

  render();

  window.addEventListener("beforeunload", function () {
    var elapsedMs = Date.now() - startTime;
    var totalSeconds = Math.floor(elapsedMs / 1000);
    var hh = Math.floor(totalSeconds / 3600);
    var mm = Math.floor((totalSeconds % 3600) / 60);
    var ss = totalSeconds % 60;
    function pad(n) {
      return (n < 10 ? "0" : "") + n;
    }
    ScormAPI.set("cmi.core.session_time", pad(hh) + ":" + pad(mm) + ":" + pad(ss) + ".00");
    var status = overallStatus();
    // "failed" still leaves the Retry button available -- without
    // per-lesson retry limits (not built yet), the learner isn't done
    // just because one attempt failed, so the session should resume the
    // same as "incomplete" rather than being treated as finished.
    var isFinished = status === "passed" || status === "completed";
    ScormAPI.set("cmi.core.exit", isFinished ? "" : "suspend");
    persist();
    ScormAPI.finish();
  });
})();
`.trim();
}
