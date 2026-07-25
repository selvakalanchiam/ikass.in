(function(){
"use strict";
async function downloadFile(url, filename) {
            const rawUrl = url.replace('/blob/', '/raw/');
            try {
                const response = await fetch(rawUrl);
                if (!response.ok) throw new Error('Download failed');
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            } catch (error) {
                console.error('Download error:', error);
                window.open(rawUrl, '_blank');
            }
        }


// expose handlers referenced via inline onclick="..." in generated HTML
  window.downloadFile = downloadFile;
})();
