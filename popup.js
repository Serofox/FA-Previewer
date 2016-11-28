var dbg = false;

$(document.body).append($('<div id="fa_popup"></div>'));
var popup_div = $($('#fa_popup')[0]);
popup_div.hide();
var callbacks = {};
var px = -1;
var py = -1;
var hoveredImgSrc = null;
var hoveredSid = null;

var imgs = $('img');
$.each(imgs, function(_, img) {
  // Make sure it's a submission
  if (!isThumbnail(img)) {
    return;
  }

  var src = $(img).attr('src');
      
  $(img).hoverIntent(
    function(e) {
      //
      // Apparently hover intent gives you the location
      // of mouse /entrance/, not current location...
      // So we update the x and y coordinates of the event
      // object to the latest known position
      //
      
      e.pageX = px;
      e.pageY = py;
      
      mouse_move(e);
      popup(this, e);

      //
      // Hack since the loading image will only appear after
      // you move your mouse again after hoverIntent triggers
      // and I'm too stupid and lazy to figure out why
      //

      mouse_move(e);
    },
    function() {
      px = py = -1;

      hoveredImgSrc = null;
      hoveredSid = null;
      
      $(popup_div.children("#popup_img")).hide();
      $(popup_div.children("#loading_img")).hide();
      $(popup_div.children("#error_img")).hide();
      popup_div.hide();
    }
  );
  
  img.onmousemove = mouse_move;
});

$(document).ready(function() {
  
  $('body').keyup(function (e) {
    if (e.which == 83) { // 'S'
      if (hoveredImgSrc != null) {
        downloadImage(hoveredImgSrc);
      }
    } else if (e.which == 70) { // 'F'
      if (hoveredSid != null) {
        doFave(hoveredSid);
      }
    }
  })
});

function isThumbnail(img) {
  return $(img).attr('src').indexOf('t.facdn.net') !== -1;
}

function getSubmissionPage(sid, callback)
{
	sid_num = sid;
	
	if(sid_num.indexOf("sid-") == 0)
	{
		sid_num = sid_num.substring("sid-".length);
	}
	
	sub_link = "/view/" + sid_num + "/";
	
	$.ajax(sub_link, {dataType: 'text'})
    .success(function(data)
	{
		callback(data);
	})
	.error(function(data, text, xhr)
	{
		console.error('Submission request failed: ' + text + '\n' + data);
		callback(null);
	});
}

function getFullImageSrc(thumbnail, callback)
{
	var sid = $(thumbnail).parents('figure').first().attr('id');
	
	if(sid && localStorage[sid])
	{
		callback(sid, localStorage[sid]);
		return;
	}
	
	if(sid && callbacks[sid])
	{
		var orig_callback = callbacks[sid];
		
		callbacks[sid] = function(sid, img_src)
		{
			orig_callback(sid, img_src);
			callback(sid, img_src);
		}
		
		return;
	}

  callbacks[sid] = callback;
  getSubmissionPage(sid, function (data) {
    if (!data) {
      callbacks[sid](null, chrome.extension.getURL("error.png"));
      callbacks[sid] = null;
      return;
    }

    var match = data.match(/var\s+full_url\s*=\s*"([^"]+)"/);
      
    if (match) {
      img_src = match[1];
    }
    
    if (img_src && sid) {
      localStorage[sid] = img_src;
      callbacks[sid](sid, img_src);
    } else {
      console.error("Couldn't find submission image (sid: " + sid +") => " + img_src);
      callbacks[sid](null, chrome.extension.getURL("error.png"));
      callbacks[sid] = null;
    }
  })
}

function getSubmissionTitle(sid)
{
	var title = $("#" + sid + " figcaption a").first().text();
	
	if(title)
	{
		return '"' + title + '"';
	}
	
	return "a murry masterpiece";
}

function doFave(sid)
{
	var submission_title = getSubmissionTitle(sid);
	var pnotify = $.pnotify({
		title: 'Faving Image...',
		text: 'Faving ' + submission_title,
		type: 'info'
	});
	
	getSubmissionPage(sid, function(data)
	{
		if(!data)
		{
			onFaveError(pnotify, submission_title);
			return;
		}
		
		var has_faved_match = data.match(/>\s*-Remove from Favorites\s*</);
		if(has_faved_match)
		{
			// Already faved
			onFaveSuccess(pnotify, submission_title);
			return;
		}
		
		var fave_url_match = data.match(/a\s+href\s*=\s*"(\/fav\/[^"]+)"/);
		if(!fave_url_match)
		{
			onFaveError(pnotify, submission_title);
			return;
		}
		
		$.ajax(fave_url_match[1])
		.success(function(data)
		{
			onFaveSuccess(pnotify, submission_title);
		})
		.error(function(data, text, xhr)
		{
			console.error('Fave request failed: ' + text + '\n' + data);
		});
	});
}

function onFaveSuccess(pnotify, submission_title)
{
	pnotify.pnotify({
		title: 'Image Faved!',
		text: getFaveSuccessMessage(submission_title),
		type: 'success'
	});
	
	pnotify.pnotify_queue_remove();
}

function onFaveError(pnotify, submission_title)
{
	pnotify.pnotify({
		title: 'Fave Error',
		text: 'There was an error faving ' + submission_title + ' :(',
		type: 'error'
	});
	
	pnotify.pnotify_queue_remove();
}

function getFaveSuccessMessage(title)
{
	var choice = Math.random();
	var lower_title = title.toLowerCase();
	
	if(lower_title.indexOf("red") >= 0 && lower_title.indexOf("panda") >= 0)
	{
		return "Yay red pandas! :D"
	}

	if(choice < .01)	return "Faved... but would you want your mother to know you're into " + title + "?";
	if(choice < .1)		return "Ah, we see " + title + " pleases your plums!";
	if(choice < .25)	return "We've noted that " + title + " tickles your fancy!";
	if(choice < .5)		return title + " is the bees knees!";
	if(choice < .75)	return "Gotcha, " + title + " floats your boat!";
	
	return 'Successfully faved ' + title;
}

function id(o) {
  return o;
}

function popup(img, e) {
  px = e.pageX;
  py = e.pageY;
  
  var popup_img, loading_img;
  popup_div.height(1).width(1)
    .empty()
    .append(loading_img = $('<img id="loading_img" />'))
    .show();

  // Give the image 100ms to load before showing the loading gif since it can
  // be a bit jarring to have show and immediately disappear
  setTimeout(function () {
    if (popup_div.children("#loading_img").length > 0) {
      loading_img
        .attr('src', chrome.extension.getURL("loading.gif"))
        .data('width', loading_img.attr('width'))
        .data('height', loading_img.attr('height'));
    }
  }, 100);

  popup_img = $('<img id="popup_img"></img>')

  maybeShowFaveFeatureNotif();

  getFullImageSrc(img, function (sid, img_src) {

      console.log(img);
      console.log("img_src: " + img_src);
    popup_div.append(
      popup_img.attr({src: img_src})
      .load(function() {
        hoveredImgSrc = img_src;
        hoveredSid = sid;
        popup_img.data('width', popup_img.width()).data('height', popup_img.height());
        popup_div.children("#loading_img").remove();
        move_image($(this), px, py);
        $(this).show("fade", {}, 300);
      })
      .error(function() {
        $(popup_div.children("#loading_img")[0]).remove();
        popup_div.append($('<img id="error_img" src="'
        + chrome.extension.getURL("error.png") + '"/>'));
      })
      .hide()
    )
  });
}

function mouse_move(e) {
  px = e.pageX;
  py = e.pageY;

  // Check if we're still loading
  if (popup_div.children('#loading_img').length > 0) {
    popup_div.offset({left: e.pageX - 63, top: e.pageY - 28});
  } else {
    move_image(popup_div.children("#popup_img").first(), e.pageX, e.pageY);
  }
}

function move_image(img, pageX, pageY)
{
  var vp = viewport();
  
  var owidth = img.data('width') || 0;
  var oheight = img.data('height') || 0;

  var show_left = (pageX > vp.x + (vp.cx / 2));

  var max_height = vp.cy - 55;
  if (oheight && oheight != 0) {
    max_height = Math.min(max_height, oheight);
  }
  
  var max_width = show_left ? pageX - vp.x - 45 : vp.cx - (pageX - vp.x) - 45;
  if (owidth && owidth != 0) {
    max_width = Math.min(max_width, owidth);
  }
  
  var ratio = Math.min( max_width / (1.0 * owidth), max_height / (1.0 * oheight));
  
  var width = ratio * owidth;
  var height = ratio * oheight;

  var x, y;
  
  if (pageY + 75 - oheight > vp.y + 25) {
    y = pageY + 75 - height;
  } else {
    y = vp.y + 25;
  }
  
  if (show_left) {
    x = pageX - 20 - width;
  } else {
    x = pageX + 20;
  }
  
  dbg && console.log("x: " + x + ", y: " + y + ", width: " + width + ", height: " + height + ", max_width: " + max_width + ", max_height: " + max_height + ", owidth: " + owidth + ",oheight: " + oheight);

  popup_div.offset({left: x, top: y});

  img.css({"max-height": max_height, "max-width": max_width});
  img.height(height).width(width);
  popup_div.height(height).width(width);
  
  dbg && popup_div.css("border", "3px solid red");
}

function viewport() {
  return {
    x: $(window).scrollLeft(),
    y: $(window).scrollTop(),
    cx: $(window).width(),
    cy: $(window).height()
  };
}

function maybeShowFaveFeatureNotif() {
  if (!localStorage["faveFeatureNotifShown"]) {
    $.pnotify({
      title: 'New FA Previewer Feature',
      text: 'Press the \'F\' key while hovering over an image to fave it.  Murrtastic!<br/><br/><3 Sero',
      type: 'info'
    });
    localStorage["faveFeatureNotifShown"] = true;
  }
}

function downloadImage(image_src) {
  var a = document.createElement('a');
  a.href = image_src;
  a.download = image_src.split('/').pop().split('?')[0]; // Prettify the download name
  if (!a.download) { a.download = 'fa' + Date.now() + '.jpg'; }
  var clickEvent = document.createEvent('MouseEvent');
  clickEvent.initEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
  a.dispatchEvent(clickEvent);
}
