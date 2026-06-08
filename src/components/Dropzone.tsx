import React, { useCallback } from 'react';
import { UploadCloud, FolderUp } from 'lucide-react';

interface DropzoneProps {
    onFilesAdded: (files: File[]) => void;
}

export function Dropzone({ onFilesAdded }: DropzoneProps) {
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files);
            if (filesArray.length > 0) {
                onFilesAdded(filesArray);
            }
        }
    }, [onFilesAdded]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            if (filesArray.length > 0) {
                onFilesAdded(filesArray);
            }
        }
        // clear value to allow same folder selection again
        e.target.value = '';
    }, [onFilesAdded]);

    return (
        <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="w-full max-w-2xl mx-auto border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:bg-gray-50 transition-colors"
        >
            <input
                type="file"
                id="file-upload"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
            />
            <input
                type="file"
                id="folder-upload"
                webkitdirectory=""
                // @ts-ignore
                directory=""
                className="hidden"
                onChange={handleFileInput}
            />
            <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-900 font-medium text-lg mb-1">Upload Product Images</p>
            <p className="text-gray-500 mb-6">Select a parent folder containing product named folders, or upload specific product folders directly.</p>
            
            <div className="flex items-center justify-center gap-4">
                <button
                    onClick={() => document.getElementById('folder-upload')?.click()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                    <FolderUp className="w-4 h-4" />
                    Select Folder
                </button>
                <button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                    Select Files
                </button>
            </div>
        </div>
    );
}
