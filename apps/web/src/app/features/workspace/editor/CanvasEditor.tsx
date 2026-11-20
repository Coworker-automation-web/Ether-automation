import { YJS } from "@ether/shared";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import type { CollabConnection } from "../../../lib/collab/types";
import type { CurrentUser, DocNode } from "../../../lib/contracts";
import { colorForUser } from "../../../lib/collab/colors";
import { toDocNode, toJsonContent } from "../../../lib/doc";
import { attributionName } from "../../ai/attribution";
import { AiBlock } from "./aiBlock";
import styles from "./editor.module.css";
import type { EditorHandle, EditorViewState } from "./handle";

export interface CanvasEditorProps {
  readonly connection: CollabConnection;
  readonly user: CurrentUser;
  readonly editable: boolean;
  readonly onReady: (handle: EditorHandle | null) => void;
  readonly onViewState: (state: EditorViewState) => void;
}

function createHandle(editor: Editor): EditorHandle {
  return {
    getSelectionText() {
      const { from, to, empty } = editor.state.selection;
      return empty ? "" : editor.state.doc.textBetween(from, to, "\n");
    },
    getDocumentText() {
      const { doc } = editor.state;
      return doc.textBetween(0, doc.content.size, "\n\n", "\n");
    },
    insertAiBlock(blocks, requestedBy) {
      if (!editor.isEditable) return false;
      const { $to } = editor.state.selection;
      // After the top-level block under the cursor: AI text is always a new block, never over user text.
      const pos = $to.depth >= 1 ? $to.after(1) : editor.state.doc.content.size;
      const node: JSONContent = {
        type: "aiBlock",
        attrs: { requestedBy: attributionName(requestedBy) },
        content: blocks.length > 0 ? blocks.map(toJsonContent) : [{ type: "paragraph" }],
      };
      try {
        return editor.chain().insertContentAt(pos, node).run();
      } catch {
        return false;
      }
    },
    focus() {
      editor.commands.focus("end");
    },
  };
}

/** The live editor. Default export so the workspace can load it lazily and keep TipTap out of the shell. */
export default function CanvasEditor({ connection, user, editable, onReady, onViewState }: CanvasEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        // Yjs owns undo/redo; the prototype's palette styles h2/h3 only; no links or underline in the vocabulary.
        undoRedo: false,
        heading: { levels: [2, 3] },
        link: false,
        underline: false,
        strike: false,
        horizontalRule: false,
      }),
      AiBlock,
      Collaboration.configure({ document: connection.doc, field: YJS.TEXT_FRAGMENT }),
      CollaborationCaret.configure({
        provider: connection.provider,
        user: { name: attributionName(user.name), color: colorForUser(user.id) },
      }),
    ],
    [connection, user.id, user.name],
  );

  const editor = useEditor(
    {
      extensions,
      editable,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": "Document",
          spellcheck: "false",
        },
      },
    },
    [extensions],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const handle = createHandle(editor);
    const emit = (): void => onViewState({ empty: editor.isEmpty, focused: editor.isFocused });
    editor.on("update", emit);
    editor.on("focus", emit);
    editor.on("blur", emit);
    emit();
    onReady(handle);

    // Mock transport only: lets the mock API read and replace this document the way the server room would.
    const unbind = connection.mock?.bind({
      getContent: (): DocNode => toDocNode(editor.getJSON()),
      applyContent: (doc: DocNode): void => {
        editor.commands.setContent(toJsonContent(doc), { emitUpdate: true });
      },
    });

    return () => {
      editor.off("update", emit);
      editor.off("focus", emit);
      editor.off("blur", emit);
      unbind?.();
      onReady(null);
    };
  }, [editor, connection, onReady, onViewState]);

  return (
    <div className={styles["editorArea"]}>
      {editor && <EditorContent editor={editor} />}
    </div>
  );
}
