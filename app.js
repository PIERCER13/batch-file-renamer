// @author piercer
(() => {
  let files = []; // { name, handle? }
  let canDirectRename = false;

  const els = {
    btnPickDir: document.getElementById("btnPickDir"),
    fileInput: document.getElementById("fileInput"),
    findStr: document.getElementById("findStr"),
    replaceStr: document.getElementById("replaceStr"),
    useRegex: document.getElementById("useRegex"),
    removeAccents: document.getElementById("removeAccents"),
    prefix: document.getElementById("prefix"),
    suffix: document.getElementById("suffix"),
    caseMode: document.getElementById("caseMode"),
    seqMode: document.getElementById("seqMode"),
    seqStart: document.getElementById("seqStart"),
    btnApplyDirect: document.getElementById("btnApplyDirect"),
    btnExportPs1: document.getElementById("btnExportPs1"),
    btnExportSh: document.getElementById("btnExportSh"),
    previewBody: document.getElementById("previewBody"),
    countLabel: document.getElementById("countLabel"),
  };

  function esc(s) {
    return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function splitExt(name) {
    const idx = name.lastIndexOf(".");
    if (idx <= 0) return [name, ""];
    return [name.slice(0, idx), name.slice(idx)];
  }

  function applyCase(stem, mode) {
    if (mode === "lower") return stem.toLowerCase();
    if (mode === "upper") return stem.toUpperCase();
    if (mode === "snake") {
      return stem.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[\s\-]+/g, "_").toLowerCase();
    }
    if (mode === "kebab") {
      return stem.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
    }
    return stem;
  }

  function computeNewName(original, index) {
    let [stem, ext] = splitExt(original);
    const find = els.findStr.value;
    const repl = els.replaceStr.value;

    if (find) {
      try {
        if (els.useRegex.checked) {
          stem = stem.replace(new RegExp(find, "g"), repl);
        } else {
          stem = stem.split(find).join(repl);
        }
      } catch {}
    }

    if (els.removeAccents.checked) {
      stem = stem.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    stem = applyCase(stem, els.caseMode.value);
    stem = `${els.prefix.value}${stem}${els.suffix.value}`;

    const seqMode = els.seqMode.value;
    if (seqMode !== "none") {
      const start = parseInt(els.seqStart.value, 10) || 1;
      const num = String(start + index).padStart(3, "0");
      stem = seqMode === "prefix" ? `${num}_${stem}` : `${stem}_${num}`;
    }

    return `${stem}${ext}`;
  }

  function getPlan() {
    return files.map((f, i) => ({
      ...f,
      nextName: computeNewName(f.name, i),
    }));
  }

  function render() {
    els.countLabel.textContent = `${files.length} arquivo(s) carregado(s)`;
    els.btnApplyDirect.disabled = !canDirectRename || !files.length;
    if (!files.length) {
      els.previewBody.innerHTML = `<tr><td colspan="3" class="empty">Selecione uma pasta ou arquivos para visualizar as alterações.</td></tr>`;
      return;
    }
    const plan = getPlan();
    els.previewBody.innerHTML = plan
      .map((item) => {
        const changed = item.name !== item.nextName;
        return `<tr>
          <td>${esc(item.name)}</td>
          <td class="${changed ? "changed" : "same"}">${esc(item.nextName)}</td>
          <td>${changed ? "Renomear" : "Sem alteração"}</td>
        </tr>`;
      })
      .join("");
  }

  els.btnPickDir.addEventListener("click", async () => {
    if (!window.showDirectoryPicker) {
      alert("Seu navegador não suporta acesso direto a pastas. Use 'Selecionar Arquivos' e baixe o script .ps1/.sh.");
      return;
    }
    try {
      const dir = await window.showDirectoryPicker({ mode: "readwrite" });
      files = [];
      for await (const entry of dir.values()) {
        if (entry.kind === "file") files.push({ name: entry.name, handle: entry });
      }
      files.sort((a, b) => a.name.localeCompare(b.name));
      canDirectRename = files.some((f) => typeof f.handle?.move === "function");
      render();
    } catch {}
  });

  els.fileInput.addEventListener("change", () => {
    files = [...els.fileInput.files].map((f) => ({ name: f.name })).sort((a, b) => a.name.localeCompare(b.name));
    canDirectRename = false;
    render();
  });

  els.btnApplyDirect.addEventListener("click", async () => {
    const plan = getPlan().filter((p) => p.name !== p.nextName && p.handle?.move);
    if (!plan.length) return;
    if (!confirm(`Renomear ${plan.length} arquivo(s) diretamente na pasta?`)) return;
    let ok = 0;
    for (const item of plan) {
      try {
        await item.handle.move(item.nextName);
        item.name = item.nextName;
        ok++;
      } catch {}
    }
    alert(`${ok} arquivo(s) renomeado(s) com sucesso!`);
    render();
  });

  function downloadScript(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  els.btnExportPs1.addEventListener("click", () => {
    const plan = getPlan().filter((p) => p.name !== p.nextName);
    if (!plan.length) return alert("Nenhuma alteração para exportar.");
    const lines = plan.map((p) => `Rename-Item -LiteralPath "${p.name.replaceAll('"', '`"')}" -NewName "${p.nextName.replaceAll('"', '`"')}"`);
    downloadScript("renomear_lote.ps1", lines.join("\r\n"));
  });

  els.btnExportSh.addEventListener("click", () => {
    const plan = getPlan().filter((p) => p.name !== p.nextName);
    if (!plan.length) return alert("Nenhuma alteração para exportar.");
    const lines = ["#!/usr/bin/env bash", ...plan.map((p) => `mv -n -- "${p.name.replaceAll('"', '\\"')}" "${p.nextName.replaceAll('"', '\\"')}"`)];
    downloadScript("renomear_lote.sh", lines.join("\n"));
  });

  [els.findStr, els.replaceStr, els.useRegex, els.removeAccents, els.prefix, els.suffix, els.caseMode, els.seqMode, els.seqStart].forEach((el) => {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });

  render();
})();

(() => {
  const AUTO_KEY = "piercer_autosave_piercer_batch-file-renamer";
  const ctrls = () => [...document.querySelectorAll('input[id]:not([type=file]), select[id], textarea[id]')];
  function saveForm() {
    const data = {};
    for (const el of ctrls()) data[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    localStorage.setItem(AUTO_KEY, JSON.stringify(data));
  }
  try {
    const saved = JSON.parse(localStorage.getItem(AUTO_KEY) || 'null');
    if (saved) {
      for (const el of ctrls()) {
        if (!(el.id in saved)) continue;
        if (el.type === 'checkbox') el.checked = !!saved[el.id];
        else el.value = saved[el.id];
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  } catch {}
  document.addEventListener('input', saveForm);
  document.addEventListener('change', saveForm);
})();
