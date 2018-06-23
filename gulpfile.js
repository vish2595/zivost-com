'use strict';

// Gulp and node
const gulp = require('gulp');
const cp = require('child_process');
const notify = require('gulp-notify');
const size = require('gulp-size');

// Basic workflow plugins
const browserSync = require('browser-sync');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const clean = require('gulp-clean');
const sass = require('gulp-sass');
const jekyll = process.platform === 'win32' ? 'jekyll.bat' : 'jekyll';
const messages = {
    jekyllBuild: '<span style="color: grey">Running:</span> $ jekyll build'
};

// Performance workflow plugins
const htmlmin = require('gulp-htmlmin');
const prefix = require('gulp-autoprefixer');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify');
const critical = require('critical');
const sw = require('sw-precache');

// Image Generation
const responsive = require('gulp-responsive');
const $ = require('gulp-load-plugins')();
const rename = require('gulp-rename');
const imagemin = require('gulp-imagemin');

const src = {
    css: '_sass/jekyll.scss',
    js: '_js/scripts.js',
};

const dist = {
    css: '_site/blog/assets/css',
    js: '_site/blog/assets/js',
};

function handleErrors() {
    const args = Array.prototype.slice.call(arguments);
    notify.onError({
        title: 'Compile Error',
        message: '<%= error.message %>'
    }).apply(this, args);
    this.emit('end'); // Keep gulp from hanging on this task

}

// Build the Jekyll Site
gulp.task('jekyll-build', gulp.series(function (done) {
    browserSync.notify(messages.jekyllBuild);
    return cp.spawn(jekyll, ['build'], {stdio: 'inherit'})
        .on('close', done);
}));

gulp.task('deploy', gulp.series(['jekyll-build'], function () {
    return gulp.src('./_site/blog/**/*')
        .pipe(deploy());
}));

// Rebuild Jekyll & do page reload
gulp.task('rebuild', gulp.series(['jekyll-build'], function (done) {
    browserSync.reload();
    done();
}));

// SASS
gulp.task('sass', gulp.series(function () {
    return gulp.src(src.css)
        .pipe(sourcemaps.init())
        .pipe(sass({
            outputStyle: 'compressed',
            includePaths: ['scss'],
            onError: browserSync.notify
        }).on('error', sass.logError))
        .pipe(sourcemaps.write({includeContent: false}))
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(prefix())
        .pipe(sourcemaps.write('./'))
        .pipe(rename({basename: 'main'}))
        .pipe(gulp.dest(dist.css))
        .pipe(browserSync.reload({stream: true}))
        .pipe(gulp.dest('blog/assets/css'))
}));


//  JS
gulp.task('js', gulp.series(function () {
    return browserify(src.js, {debug: true, extensions: ['es6']})
        .transform('babelify', {presets: ['es2015']})
        .bundle()
        .on('error', handleErrors)
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(uglify())
        .pipe(sourcemaps.write('./maps'))
        .pipe(size())
        .pipe(gulp.dest(dist.js))
        .pipe(browserSync.reload({stream: true}))
        .pipe(gulp.dest('blog/assets/js'))
}));

gulp.task('critical', gulp.series(function (cb) {
    critical.generate({
        base: '_site/',
        src: 'index.html',
        css: ['blog/assets/css/main.css'],
        dimensions: [{
            width: 320,
            height: 480
        }, {
            width: 768,
            height: 1024
        }, {
            width: 1280,
            height: 960
        }],
        dest: '../_includes/critical.css',
        minify: true,
        extract: false,
        ignore: ['@font-face']
    });
}));

// Minify HTML
gulp.task('html', gulp.series(function () {
    gulp.src('./_site/blog/index.html')
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('./_site/blog/'));
    gulp.src('./_site/*/*html')
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('./_site/blog/./'));
}));

gulp.task('sw', gulp.series(function (done) {
    const rootDir = './';
    const distDir = './_site/';

    sw.write(`${rootDir}/sw.js`, {
        staticFileGlobs: [distDir + '/**/*.{js,html,css,png,jpg,svg}'],
        stripPrefix: distDir
    });
    done();
}));

// Images
gulp.task('img', gulp.series(function () {
    return gulp.src('_img/posts/*.{png,jpg}')
        .pipe($.responsive({
            // For all the images in the folder
            '*': [{
                width: 230,
                rename: {suffix: '_placehold'},
            }, {
                // thubmnail
                width: 535,
                rename: {suffix: '_thumb'},
            }, {
                // thumbnail @2x
                width: 535 * 2,
                rename: {suffix: '_thumb@2x'},
            }, {
                width: 575,
                rename: {suffix: '_xs'}
            }, {
                width: 767,
                rename: {suffix: '_sm'}
            }, {
                width: 991,
                rename: {suffix: '_md'}
            }, {
                width: 1999,
                rename: {suffix: '_lg'}
            }, {
                // max-width hero
                width: 1920,
            }],
        }, {
            quality: 70,
            progressive: true,
            withMetadata: false,
        }))
        .pipe(imagemin())
        .pipe(gulp.dest('assets/img/posts/'));
}));


gulp.task('clean', gulp.series(function () {
    return gulp.src('_site', {read: false})
        .pipe(clean());
}));

gulp.task('serve', gulp.series(function (done) {
    browserSync({
        server: {
            baseDir: '_site'
        }
    },done);
}));

gulp.task('watch', gulp.series(function () {
    gulp.watch('_sass/**/*.scss', gulp.series(['sass'], function(done){
        done()
    }));
    gulp.watch(['*.html', '_layouts/*.html', '_includes/*.html', '_posts/*.md', 'pages_/*.md', '_include/*html'], gulp.series(['rebuild'], function(done){
        done()
    }));
    gulp.watch(src.js, gulp.series(['js'], function(done){
        done()
    }));
}));

// Serve after jekyll-build
gulp.task('browser-sync', gulp.series(['sass', 'js', 'sw', 'jekyll-build'], function (done) {
    browserSync({
        server: {
            baseDir: '_site'
        }
    },done);
}));


gulp.task('default', gulp.series(['browser-sync', 'watch'],function(done) {
    done();
}));

gulp.task('build', gulp.series(['sass', 'js', 'jekyll-build', 'img', 'sw'], function(done) {
    done();
}));
