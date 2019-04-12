import * as vscode from 'vscode';
import { ExtensionContext, Position, Range, Selection } from 'vscode';

import { IConfig } from './types';

function isCompleteRange(selection: Selection, firstLine: vscode.TextLine, lastLine: vscode.TextLine): boolean {
	const selectionStart = firstLine.text.slice(selection.start.character);
	const selectionEnd = lastLine.text.slice(0, selection.end.character);

	return firstLine.text.trim() === selectionStart.trim() && lastLine.text.trim() === selectionEnd.trim();
}

function betterTab(isReverse: boolean, editor: vscode.TextEditor): void {
	const config = vscode.workspace.getConfiguration('betterTab') as any as IConfig;
    const newSelections: Selection[] = [];

    let foo : vscode.Uri;
    let n = 1;
    if (vscode.window.activeTextEditor !== undefined)
        n = vscode.workspace.getConfiguration('editor', vscode.window.activeTextEditor.document.uri).get('tabSize') as number;

	editor.edit(builder => {
		for (const selection of editor.selections) {
			let start = selection.start;
			let end = selection.end;
			const isSelectionStartHasCursor = start.line === selection.active.line && start.character === selection.active.character;

			if (editor.selections.length === 1 && selection.isSingleLine && !config.workOnSingleLine) {
				vscode.commands.executeCommand('type', { text: ' '.repeat(n) });
				return;
			}

			const lines: vscode.TextLine[] = [];
			for (let i = start.line; i <= end.line; i++) {
				lines.push(editor.document.lineAt(i));
			}

			if (isReverse) {// Move left
				if (selection.isSingleLine && start.character === end.character &&
					lines[0].text.slice(0, selection.start.character).trim() !== '') {
					vscode.commands.executeCommand('type', { text: ' '.repeat(n) });
					return;
				}
				let isStartLineShifted = false;
                let isEndLineShifted = false;

                let needCramming : boolean = false;
                for (let i = 0; i < n; i++) {
                    if (lines.some(line => line.text[i] !== ' '))
                        needCramming = true;
                }

				if (!config.cramReversed && needCramming) {
					// vscode.window.showInformationMessage('Cram disabled!');// Dev notification
					if (isSelectionStartHasCursor) {
						[start, end] = [end, start];
					}

					newSelections.push(new Selection(start, end));// preserve old selection
					continue;
				}

				if (lines.every(line => line.text[0] !== ' ') && end.character !== 0) {
					// vscode.window.showInformationMessage('Nothing to cram!');// Dev notification
					if (isSelectionStartHasCursor) {
						[start, end] = [end, start];
					}

					newSelections.push(new Selection(start, end));
					continue;
				}

				lines.forEach((line, i) => {
                    let j = 0;
                    for (; j < n; j++)
                        if (line.text[j] !== ' ')
                            break;

					if (j > 0) {
						if (i === 0) isStartLineShifted = true;
						if (i === lines.length - 1) isEndLineShifted = true;

						builder.delete(new Range(line.lineNumber, 0, line.lineNumber, j));
					}
				});

				if (isSelectionStartHasCursor) {
					[start, end] = [end, start];
				}

				let newEndChar = end.character;
				let newStartChar = start.character;

				if (isStartLineShifted) {
					newEndChar = end.character - n;
				}
				if (isEndLineShifted) {
					newStartChar = start.character - n;
				}

				if (selection.isSingleLine) {
					if (newEndChar < 0) {
						newStartChar = newStartChar + n;
					}
					if (newStartChar < 0) {
						newEndChar = newEndChar + n;
					}
				}

				if (newStartChar < 0) newStartChar = 0;
				if (newEndChar < 0) newEndChar = 0;

				newSelections.push(new Selection(
					start.line, newStartChar,
					end.line, newEndChar
				));
			} else {// Move right
				if (config.onlyCompleteRange && !isCompleteRange(selection, lines[0], lines[lines.length - 1])) {
					vscode.commands.executeCommand('type', { text: ' '.repeat(n) });
					return;
				}

				for (let i = start.line; i <= end.line; i++) {
					builder.insert(new Position(i, 0), ' '.repeat(n));
				}

				if (isSelectionStartHasCursor) {
					[start, end] = [end, start];
				}

				newSelections.push(new Selection(
					start.line, start.character + n,
					end.line, end.character + n
				));
			}
		}
	});

	editor.selections = newSelections;
}

export function activate(context: ExtensionContext): void {
	const indent = vscode.commands.registerTextEditorCommand('betterTab.indent', betterTab.bind(null, false));
	const outdent = vscode.commands.registerTextEditorCommand('betterTab.outdent', betterTab.bind(null, true));

	context.subscriptions.push(indent, outdent);
}

export function deactivate() { }