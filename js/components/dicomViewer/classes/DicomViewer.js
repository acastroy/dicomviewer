import $ from 'jquery';
import { DCMViewer } from '../../../lib/components/viewerMain';
import initializeViewerMain from '../initializeViewerMain';
import configureCodecs from '../configureCodecs';
import ImageLoader from './ImageLoader';
import { DCMViewerError } from '../../../lib/components/DCMViewerError';

class DicomViewer {
    constructor() {
        this.mimeType = 'application/dicom';
        this.isViewerMainShown = false;

        configureCodecs();
    }

    /**
     * Initialize DICOMViewerPlugin actions
     * @param fileList
     */
    attach(fileList) {
        this._registerFileActions(fileList.fileActions);
    }

    /**
     * Hide viewer
     */
    hide() {
        // Destroy the active image loader
        if (this.activeImageLoader) {
            this.activeImageLoader.destroy();
            this.activeImageLoader = null;
        }

        $('#viewerMain').remove();
        $('#app-content-files').css({ display: 'block' });

        // Show footer on public template
        if ($('#isPublic').val()) {
            $('#content').removeClass('full-height');
            $('footer').removeClass('hidden');
        }

        this.isViewerMainShown = false;

        FileList.setViewerMode(false);
    }

    /**
     * Show viewer
     * @param imageLoadPromise
     * @param isSingleDICOMFile
     */
    show(imageLoadPromise, isSingleDICOMFile) {
        const self = this;
        const url = OC.generateUrl('/apps/dicomviewer/viewerMain');

        $.ajax({
            url,
            type: 'GET',
            contentType: 'text/html',
            data: {
                isSingleDICOMFile
            }
        }).done((response) => {
            const $appContent = $('#content');

            // Go back on ESC
            $(document).keyup((e) => {
                if (self.isViewerMainShown && e.keyCode === 27) {
                    self.hide();
                }
            });

            // Hide footer on public template
            if ($('#isPublic').val()) {
                $('#content').addClass('full-height');
                $('footer').addClass('hidden');
            }

            $('#app-content-files').css({ display: 'none' });
            $appContent.append(response);

            if (!$('html').hasClass('ie8')) {
                history.pushState({}, '', '#dcmviewer');
            }

            if (!$('html').hasClass('ie8')) {
                $(window).one('popstate', () => {
                    self.hide();
                });
            }

            self.isViewerMainShown = true;

            // Close viewer
            DCMViewer.ui.closeViewer = self.hide;

            imageLoadPromise.then((viewerData) => {
                initializeViewerMain(viewerData);
            }).catch(() => new DCMViewerError('Failed to load images'));
        });
    }

    /**
     * Register file actions for dicom files
     * @param fileActions
     * @private
     */
    _registerFileActions(fileActions) {
        const self = this;

        // Register file actions for folders containing dicom files
        fileActions.registerAction({
            name: 'viewDicomFolder',
            displayName: 'Open with DICOM Viewer',
            mime: 'httpd/unix-directory',
            permissions: OC.PERMISSION_READ,
            order: -10000,
            templateName: 'viewerMain',
            iconClass: 'icon-dicomviewer-dark',
            actionHandler: (fileName, context) => {
                // Destroy the active image loader if exists
                if (self.activeImageLoader) {
                    self.activeImageLoader.destroy();
                }

                self.activeImageLoader = new ImageLoader(context, fileName, self.mimeType, self.hide);

                const imageLoadPromise = self.activeImageLoader.loadMultipleDICOMInstances();
                self.show(imageLoadPromise);
            }
        });

        // Register file actions for single dicom files
        fileActions.registerAction({
            name: 'viewDicomFile',
            displayName: 'Open with DICOM Viewer',
            mime: this.mimeType,
            permissions: OC.PERMISSION_READ,
            templateName: 'viewerMain',
            actionHandler: (fileName, context) => {
                // Destroy the active image loader if exists
                if (self.activeImageLoader) {
                    self.activeImageLoader.destroy();
                }

                self.activeImageLoader = new ImageLoader(context, fileName, self.mimeType, self.hide);

                const isDCMFile = (/\.(dcm)$/i).test(fileName);
                if (!isDCMFile) {
                    return;
                }

                const imageLoadPromise = self.activeImageLoader.loadSingleDICOMInstance();
                self.show(imageLoadPromise, true);
            }
        });

        // Add default action
        fileActions.setDefault(self.mimeType, 'viewDicomFile');
    }
}

export default DicomViewer;
