#!/bin/sh
retval=1
while [ $retval != 0 ]; do
	ls -l /netshare > /dev/null
	retval=$?
done
