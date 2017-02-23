'use strict';

const gulp = require('gulp');
const jsdoc = require('gulp-jsdoc3');
const gulpJsdoc2md = require('gulp-jsdoc-to-markdown');
const gutil = require('gulp-util');
const rename = require('gulp-rename');

gulp.task('site', cb => {
	let config = require('./jsdoc.json');
	gulp.src(['README.md', './lib/*.js'], {read: false})
		.pipe(jsdoc(config, cb));
});

gulp.task('markdown', (cb) => {
	return gulp.src('lib/*.js')
		.pipe(gulpJsdoc2md(cb))
		.on('error', err => {
			gutil.log(gutil.colors.red('jsdoc2md failed'), err.message)
		})
		.pipe(rename(path => {
			path.extname = '.md'
		}))
		.pipe(gulp.dest('docs'))
});

gulp.task('docs', ['site', 'markdown'], () => {});
gulp.task('default', ['docs'], () => {});
